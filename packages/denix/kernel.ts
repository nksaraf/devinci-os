import type { Remote } from './lib/comlink/mod.ts';
import { Resource, op_sync, createResourceTable } from './types.ts';
import type { Op, ResourceTable } from './types.ts';
import { fromBase64 } from './lib/base64.ts';
import { ApiError, ErrorCodeToName, ERROR_KIND_TO_CODE } from './lib/error.ts';
import type { VirtualFileSystem } from './lib/fs/virtual.ts';
import type { File } from './lib/fs/core/file.ts';
import { builtIns } from './ops/builtIns.ops.ts';
import { FileResource, fsOps } from './ops/fs.ops.ts';
import { LocalNetwork, network } from './ops/network.ops.ts';
import { url } from './ops/url.ops.ts';
import { test } from './ops/test.ops.ts';
import type { ProcessManager } from './proc_manager.ts';
import type VirtualFile from './lib/fs/core/virtual_file.ts';
import { toWireValue } from './lib/comlink/http.handlers.ts';
import { newPromise } from './lib/promise.ts';

function syncOpCallXhr(op_code: string, arg1: any, arg2: any) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/~deno/op/sync/' + op_code, false);
  xhr.send(JSON.stringify([op_code, toWireValue(arg1), toWireValue(arg2)]));
  // look ma, i'm synchronous (•‿•)
  console.debug('json response', xhr.responseText);
  let result = JSON.parse(xhr.responseText.length > 0 ? xhr.responseText : 'null');
  console.debug(result);

  return result;
}

export interface ProcessOptions {
  pid: number;
  resourceTable?: { [key: number]: Resource };
  tty?: string;
  kernel: {
    fs: VirtualFileSystem;
    proc: ProcessManager;
    net: LocalNetwork;
  };
  stdin?: string;
  stdout?: string;
  stderr?: string;
  env?: {};
  cwd?: string;
  parentPid?: number;
  cmd: string[];
}

class OpTable {}

export class Kernel {
  constructor(
    public fs: VirtualFileSystem,
    public processManager: ProcessManager,
    public net: LocalNetwork,
  ) {}
}

export class Process extends EventTarget {
  env: { [key: string]: any } = {};
  cwd: any = '/.ts';

  kernel: Kernel;
  resourceTable: ResourceTable;
  private nextRid = 0;
  tty: string;
  stdin: number;
  stdout: number;
  stderr: number;

  pid: number;
  parentPid?: number;
  cmd: string[];

  readyPromise = newPromise();

  constructor({
    pid,
    parentPid = undefined,
    resourceTable = createResourceTable(),
    kernel: { fs, proc, net },
    env = {},
    cwd = '/',
    stdin,
    stdout,
    stderr,
    cmd,
  }: ProcessOptions) {
    super();
    this.pid = pid;
    this.parentPid = parentPid;
    this.resourceTable = resourceTable;
    this.kernel = new Kernel(fs, proc, net);
    this.env = env;
    this.cwd = cwd;
    this.nextRid = Object.keys(this.resourceTable).length;
    this.cmd = cmd;

    this.init({
      stdin,
      stdout,
      stderr,
    }).then(() => {
      this.readyPromise.resolve(true);
    });
  }

  get name() {
    return `proc` + this.pid;
  }

  async init({ stdin = '/dev/null', stdout = '/dev/null', stderr = '/dev/null' }): Promise<void> {
    await this.initStdio(stdin, stdout, stderr);
    this.initOps();
  }

  // run the process's command
  async run() {
    this.dispatchEvent(new CustomEvent('start', { detail: this.pid }));
    console.debug(this.cmd);
    try {
      let result = await import(/* @vite-ignore */ `/bin/${this.cmd[0]}.ts?script`);

      // this is a hack to call the below line after the async imports have actually happened and
      // the import have been resolved
      queueMicrotask(async () => {
        console.debug('RESULT', result, this.resourceTable, this.runningOps);
        if (Object.values(this.runningOps).length > 0) {
          console.debug('WATINNGGG');
          this.waitingForExit = newPromise();

          await this.waitingForExit.promise;
        }

        this.mightDie(0);
      });
      // this.dispatchEvent(new CustomEvent('success', { detail: this.pid }));
    } catch (e) {
      if (e.message.includes('Code not reachable')) {
        // console.error(e);
        // return this.exit();
        return;
      }
      console.error(e);
      this.exit(-1);
    }
  }
  mightDie(arg0: number) {
    this.dispatchEvent(new CustomEvent('might_exit', { detail: { pid: this.pid, code: arg0 } }));
  }

  waitingForExit;

  #_ops: Op[];

  _tty: File;
  private async initStdio(stdin: string, stdout: string, stderr: string) {
    let file = await this.kernel.fs.open(stdin, 1, 0o666);
    this.stdin = this.addResource(new FileResource(file as VirtualFile));
    this.stdout = this.addResource(new FileResource(file as VirtualFile));
    this.stderr = this.addResource(new FileResource(file as VirtualFile));
  }

  exit(code: any) {
    console.debug('EXITING', code);
    this.dispatchEvent(new CustomEvent('exit', { detail: { pid: this.pid, code } }));

    syncOpCallXhr('op_exit', this.pid, code);
  }

  private initOps() {
    this.#_ops = [
      op_sync('ops_sync', () => {
        // this is called when Deno.core.syncOpsCache is run
        // we have to reply with an array of [op_name, id in op_cache]]
        // Deno maintains a cache of this mapping
        // so it can call ops by passing a number, not the whole string
        return this.opsIndex;
      }),
    ];

    this.#_ops.push(
      {
        name: 'op_cwd',
        sync: () => {
          return this.cwd;
        },
        async: async () => {
          return this.cwd;
        },
      },
      ...builtIns,

      {
        name: 'op_format_file_name',
        sync: (arg) => arg,
        async: async (arg) => {
          return arg;
        },
      },

      ...network,
      ...fsOps,
      ...url,
      ...test,

      {
        name: 'op_encoding_normalize_label',
        sync: (arg) => arg,
      },
      {
        name: 'op_encoding_new_decoder',
        sync: ({ label }) => {
          return this.addResource(new TextDecoderResource());
        },
      },
      op_sync('op_env', function (this: Process) {
        return {
          PWD: '/',
        };
      }),
      {
        name: 'op_wasm_streaming_set_url',
        sync: function (this: Process, rid: number, url: string) {
          (this.getResource(rid) as WasmStreamingResource).url = url;
        },
      },

      {
        name: 'op_wasm_streaming_feed',
        sync: function (this: Process, rid: number, chunk: Uint8Array) {
          (this.getResource(rid) as WasmStreamingResource).write(chunk);
        },
      },
      {
        name: 'op_encoding_decode',
        sync: (data, { rid }) => {
          let res = this.getResource(rid) as TextDecoderResource;
          return res.decode(data);
        },
      },
      {
        name: 'op_base64_decode',
        sync: (data) => {
          return fromBase64(data);
        },
      },
    );
  }

  protected get ops() {
    return this.#_ops;
  }

  get opsIndex() {
    return this.ops.map((o, index) => [o.name, index]).slice(1);
  }

  opCode(opName: string) {
    return this.opsIndex.find(([name]) => name === opName)[1];
  }

  addResource(res: Resource) {
    let rid = this.nextRid++;
    this.resourceTable[rid] = res;
    return rid;
  }

  getResource<T extends Resource>(arg0: number): T | undefined {
    return this.resourceTable[arg0] as T;
  }

  closeResource(rid: any) {
    let resource = this.getResource(rid);
    if (resource) {
      resource.close();
    }
    delete this.resourceTable[rid];
  }

  syncOpsCount = -1;

  trackOp(i: number, op) {
    this.dispatchEvent(new CustomEvent('alive', { detail: { pid: this.pid } }));
    this.runningOps[i] = op;
  }

  resolveOp(i: number) {
    delete this.runningOps[i];
    console.debug('RESOLVING', Object.values(this.runningOps), this.resourceTable);

    queueMicrotask(() => {
      if (this.waitingForExit) {
        if (
          Object.values(this.runningOps).length === 0 &&
          Object.keys(this.resourceTable).length <= 3
        ) {
          this.dispatchEvent(new CustomEvent('might_exit', { detail: { pid: this.pid, code: 0 } }));
        }
      }
    });
  }

  opSync(index: number, arg1 = undefined, arg2 = undefined) {
    if (!this.ops[index]) {
      throw new Error(`op ${index} not found`);
    } else if (!this.ops[index].sync) {
      throw new Error(`op ${index} not sync`);
    }

    let i = this.syncOpsCount--;
    this.trackOp(i, { index, arg1, arg2 });

    queueMicrotask(() => {
      this.resolveOp(i);
    });
    // @ts-ignore
    try {
      let opResult = this.ops[index].sync.bind(this)(arg1, arg2);
      console.debug('opcall sync', this.ops[index].name, opResult);
      return opResult ?? null;
    } catch (e) {
      console.debug('SOME ERROR', e);
      if (index === this.opCode('op_exit')) {
        return null;
      }

      if (e instanceof ApiError) {
        console.debug(e.code);
        let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
        console.debug('error code', getCode);

        if (getCode) {
          return {
            $err_class_name: getCode[0],
            code: getCode[1],
            message: getCode[1],
            stack: e.stack,
          };
        } else {
          return {
            $err_class_name: 'Error',
            code: e.code,
            message: e.message,
            stack: e.stack,
          };
        }
      } else if (e.$err_class_name) {
        return e;
      } else if (e instanceof Error) {
        return {
          $err_class_name: 'Error',
          message: e.message,
          stack: e.stack,
        };
      }
      // throw e;
    }
  }

  runningOps: Record<number, any> = {};

  async opAsync(op_code: number, promiseId: number, arg1: any, arg2: any) {
    this.trackOp(promiseId, { index: op_code, arg1, arg2 });

    try {
      if (this.ops[op_code].async) {
        throw new ApiError('ENOTSUP');
      }
      const result = await this.ops[op_code].async.bind(this)(arg1, arg2);
      console.debug(result);
      queueMicrotask(() => this.resolveOp(promiseId));

      return result ?? null;
    } catch (e) {
      console.debug(e, e.prototype);
      queueMicrotask(() => this.resolveOp(promiseId));

      if (e instanceof ApiError) {
        console.debug(e.code);
        let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
        console.error('error code', getCode);
        console.error(e);
        return {
          $err_class_name: getCode[0] ?? 'Error',
          code: ErrorCodeToName[getCode[1]],
          message: ErrorCodeToName[getCode[1]],
          stack: e.stack,
        };
      }
      throw e;
    }
  }
}

export class RemoteKernel extends Process {
  proxy: Remote<Process>;

  opSync(op_code, arg1, arg2) {
    console.group('op sync', op_code, arg1, arg2);
    let result = syncOpCallXhr(op_code, arg1, arg2);
    console.debug(result);
    console.groupEnd();

    return result;
  }

  async opAsync(op_code, promiseId, arg1, arg2) {
    let result = await this.proxy.opAsync(op_code, promiseId, arg1, arg2);
    console.debug(result);
    console.groupEnd();
    return result;
  }

  constructor() {
    super();
  }

  decode(data: Uint8Array) {
    return new TextDecoder().decode(new Uint8Array(data));
  }

  encode(data: string) {
    return new TextEncoder().encode(data);
  }

  get ops(): Op[] {
    throw new Error('ops not available');
  }
}

export class WasmStreamingResource extends Resource {
  url: string;
}

class TextDecoderResource extends Resource {
  decoder = new TextDecoder();

  close() {}

  decode(data: Uint8Array) {
    return this.decoder.decode(data);
  }
}
