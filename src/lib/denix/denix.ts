import type { Remote } from 'comlink';
import { Resource, type ResourceTable, op_sync, type Op, createResourceTable } from './types';
import { fromBase64 } from '$lib/base64';
import { ApiError, ErrorCodeToName, ERROR_KIND_TO_CODE } from '$lib/error';
import type { VirtualFileSystem } from '$lib/fs/virtual';
import type { File } from '$lib/fs/core/file';
import { builtIns } from './ops/builtIns.ops';
import { FileResource, fsOps } from './ops/fs.ops';
import { LocalNetwork, network } from './ops/network.ops';
import { url } from './ops/url.ops';
import { fs as globalFS } from '$lib/fs';
import { test } from './ops/test.ops';
import type { ProcessManager } from './proc_manager';

function syncOpCallXhr(op_code: number, arg1: any, arg2: any) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/~deno/op/sync/' + op_code, false);
  xhr.send(JSON.stringify([op_code, arg1, arg2]));
  // look ma, i'm synchronous (•‿•)
  console.log('json response', xhr.responseText);
  let result = JSON.parse(xhr.responseText.length > 0 ? xhr.responseText : 'null');
  console.log(result);

  return result;
}

export interface ProcessOptions {
  pid: number;
  resourceTable?: { [key: number]: Resource };
  tty?: string;
  fs?: VirtualFileSystem;
  proc?: ProcessManager;
  net?: LocalNetwork;
  stdin?: number;
  stdout?: number;
  stderr?: number;
  env?: {};
  cwd?: string;
  parentPid?: number;
  cmd?: string[];
}

export class Process extends EventTarget {
  net: LocalNetwork = new LocalNetwork();
  env: { [key: string]: any } = {};
  cwd: any = '/';
  fs: VirtualFileSystem;
  proc: ProcessManager;
  resourceTable: ResourceTable;
  private nextRid = 0;
  tty: string;
  stdin: number;
  stdout: number;
  stderr: number;

  pid: number;
  parentPid: number;
  cmd: string[];

  constructor() {
    super();
  }

  get name() {
    return `proc` + this.pid;
  }

  async init({
    pid,
    parentPid = undefined,
    resourceTable = createResourceTable(),
    tty = '/dev/tty0',
    fs = globalFS,
    proc = undefined,
    net = new LocalNetwork(),
    stdin = 0,
    stdout = 1,
    stderr = 2,
    env = {},
    cwd = '/',
    cmd = ['/src/lib/desh/index.ts'],
  }: Partial<ProcessOptions>): Promise<void> {
    this.pid = pid;
    this.parentPid = parentPid;
    this.resourceTable = resourceTable;
    this.tty = tty;
    this.fs = fs;
    this.proc = proc;
    // this.fsRemote = fsRemote;
    // this.fsWorker = fsWorker;
    this.stdin = stdin;
    this.stdout = stdout;
    this.stderr = stderr;
    this.env = env;
    this.cwd = cwd;
    this.net = net;
    this.nextRid = Object.keys(this.resourceTable).length;
    this.cmd = cmd;
    await this.initStdio();
    this.initOps();
  }

  async run() {
    console.log(this.cmd);
    await import(`/bin/${this.cmd[0]}.ts?script`);
  }

  #_ops: Op[];

  getFileResource(path: string | number) {
    if (typeof path === 'number') {
      return this.getResource(path);
    } else {
      this.addResource(new FileResource(this.fs.openSync(path, 1, 0o666)));
    }
  }

  _tty: File;
  private async initStdio() {
    let _tty = await this.fs.open(this.tty, 1, 0o666);
    this.stdin =
      typeof this.stdin === 'number' && this.getResource(this.stdin)
        ? this.stdin
        : this.addResource(new FileResource(_tty));
    this.stdout =
      typeof this.stdout === 'number' && this.getResource(this.stdout)
        ? this.stderr
        : this.addResource(new FileResource(_tty));
    this.stderr =
      typeof this.stderr === 'number' && this.getResource(this.stderr)
        ? this.stderr
        : this.addResource(new FileResource(_tty));
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

  opSync(index, arg1 = undefined, arg2 = undefined) {
    if (!this.ops[index]) {
      throw new Error(`op ${index} not found`);
    } else if (!this.ops[index].sync) {
      throw new Error(`op ${index} not sync`);
    }

    // @ts-ignore
    try {
      let opResult = this.ops[index].sync.bind(this)(arg1, arg2);
      console.log('opcall sync', this.ops[index].name, opResult);
      return opResult ?? null;
    } catch (e) {
      console.log('SOME ERROR', e);
      if (e instanceof ApiError) {
        console.log(e.code);
        let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
        console.log('error code', getCode);
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
      throw e;
    }
  }

  async opAsync(op_code: number, promiseId: number, arg1: any, arg2: any) {
    try {
      const result = await this.ops[op_code].async.bind(this)(arg1, arg2);
      console.log(result);
      return result ?? null;
    } catch (e) {
      console.log(e, e.prototype);
      if (e instanceof ApiError) {
        console.log(e.code);
        let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
        console.log('error code', getCode);
        return {
          $err_class_name: getCode[0],
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
    console.log(result);
    console.groupEnd();

    return result;
  }

  async opAsync(op_code, promiseId, arg1, arg2) {
    let result = await this.proxy.opAsync(op_code, promiseId, arg1, arg2);
    console.log(result);
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
