import type { ResourceTable } from './interface';
import { Resource } from './interface';
import { proxy, wrap } from 'comlink';
import type { Remote } from 'comlink';
import { ApiError, ERROR_KIND_TO_CODE } from 'os/kernel/fs/core/api_error';
import { LocalNetwork, network, Socket } from './ops/network';
import { op_async, op_sync } from './interfaces';
import type { Op } from './interfaces';
import { builtIns } from './ops/builtIns';
import { fsOps } from './ops/fs';
import { url } from './ops/url';
import { VirtualFileSystem } from 'os/kernel/fs';
import EsbuildWorker from './linker/esbuild-worker?worker';
import { fromBase64 } from 'os/kernel/node/base64';
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

// export class DenoRemoteHost implements IDenoHost {
//   async getBootstrapCore(): Promise<any> {
//     return this.core;
//   }

//   setOpsResolve(cb: any) {
//     this.proxy.setOpsResolve(proxy(cb));
//   }

//   proxy: Remote<Kernel>;

//   getOpsMappings() {
//     return this.proxy.getOpsMappings();
//   }

//   core: {
//     opcallSync: (index: any, arg1: any, arg2: any) => any;
//     opcallAsync: (index: any, promiseId: any, arg1: any, arg2: any) => any;
//     callConsole: (oldLog: any, newLog: any, ...args: any[]) => void;
//     setMacrotaskCallback: (cb: any) => void;
//     setWasmStreamingCallback: (cb: any) => void;
//     decode: (data: Uint8Array) => string;
//     encode: (data: string) => Uint8Array;
//   };

//   overrideOps: Op[];

//   constructor(endpoint: any) {
//     this.proxy = wrap(endpoint);
//     this.core = {
//       opcallSync: (index, arg1, arg2) => {
//         console.group('op sync', index, arg1, arg2);
//         let result = syncOpCallXhr(index, arg1, arg2);
//         console.log(result);
//         console.groupEnd();

//         return result;
//       },
//       opcallAsync: async (index, promiseId, arg1, arg2): Promise<any> => {
//         console.group('op async', await this.proxy.ops[index].name, arg1, arg2);
//         let result = await this.proxy.opcallAsync(index, promiseId, arg1, arg2);
//         console.log(result);
//         console.groupEnd();
//         return result;
//       },
//       callConsole: (oldLog, newLog, ...args) => {
//         oldLog(...args);
//       },
//       setMacrotaskCallback: (cb) => {
//         console.log('macrostask callback');
//       },
//       setWasmStreamingCallback: (cb) => {
//         console.log('wasm streaming callback');
//       },

//       decode: function (data: Uint8Array) {
//         return new TextDecoder().decode(new Uint8Array(data));
//       },

//       encode: function (data: string) {
//         return new TextEncoder().encode(data);
//       },
//     };
//   }
// }

export class Kernel extends EventTarget {
  net: LocalNetwork = new LocalNetwork();
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
      if (e instanceof ApiError) {
        console.log(e.code);
        let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
        console.log('error code', getCode);
        return {
          $err_class_name: getCode[0],
          code: getCode[1],
        };
      }
      throw e;
    }
  }

  fs: VirtualFileSystem;

  console = console;

  get opsIndex() {
    return this.ops.map((o, index) => [o.name, index]).slice(1);
  }

  opCode(opName: string) {
    return this.opsIndex.find(([name]) => name === opName)[1];
  }

  getResource<T extends Resource>(arg0: number): T {
    return this.resourceTable.get(arg0) as T;
  }

  async opAsync(op_code: number, promiseId: number, arg1: any, arg2: any) {
    try {
      const result = await this.ops[op_code].async.bind(this)(arg1, arg2);
      console.log(result);
      return result ?? null;
    } catch (e) {
      if (e instanceof ApiError) {
        console.log(e.code);
        let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
        console.log('error code', getCode);
        return {
          $err_class_name: getCode[0],
          code: getCode[1],
        };
      }
      throw e;
    }
  }

  resourceTable: ResourceTable;

  addResource(res: Resource) {
    let rid = this.nextRid++;
    this.resourceTable.set(rid, res);
    return rid;
  }

  esbuild = wrap<{
    init: () => void;
    transpileSync: (
      data: SharedArrayBuffer,
      options: { url: string; mode: 'script' | 'module' },
    ) => void;
    transpile: (data: string, options: { url: string; mode: 'script' | 'module' }) => void;
  }>(new EsbuildWorker());

  private nextRid = 0;

  stdin: number;
  stdout: number;
  stderr: number;

  constructor() {
    super();
  }

  private init() {
    this.resourceTable = new Map<number, Resource>();

    this.stdin = this.addResource(new ConsoleLogResource());
    this.stdout = this.addResource(new ConsoleLogResource());
    this.stderr = this.addResource(new ConsoleLogResource());

    this._ops = [
      op_sync('ops_sync', () => {
        // this is called when Deno.core.syncOpsCache is run
        // we have to reply with an array of [op_name, id in op_cache]]
        // Deno maintains a cache of this mapping
        // so it can call ops by passing a number, not the whole string
        return this.opsIndex;
      }),
    ];

    this._ops.push(
      {
        name: 'op_cwd',
        sync: () => {
          return '/';
        },
        async: async () => {
          return '/';
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
      {
        name: 'op_encoding_decode',
        sync: (data, { rid }) => {
          let res = this.resourceTable.get(rid) as TextDecoderResource;
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

  createRequest() {}

  async initNetwork() {
    const { setupWorker, rest } = await import('msw');
    await this.esbuild.init();

    let requests = {};
    const handleResponse = (e) => {
      this.console.log('evenntttttt', e);
      if (e.data.type === 'RESPONSE' && requests[e.data.requestId]) {
        requests[e.data.requestId].resolve(e.data.response);
      }
    };

    this.net.channel.addEventListener('message', handleResponse);

    let worker = setupWorker(
      rest.get('https://deno.land/*', async (req, res, ctx) => {
        console.log('/deno-land');
        let originalResponse = await ctx.fetch(req.url.href);
        let text = await originalResponse.text();

        return res(ctx.body(text), ctx.set('content-type', 'application/javascript'));
      }),
      rest.get('http://localhost:4507/*', async (req, res, ctx) => {
        console.log('/deno-land', 'MIGHT WORK');
        let originalResponse = await ctx.fetch(req.url.href);
        return res(ctx.text(await originalResponse.text()));
      }),
      rest.get('/~p/:port/*', async (req, res, ctx) => {
        this.console.log(req);
        console.log('/~p/:port/*', req.url.href);
        // somebody made some kind of request to my server

        let resolve, reject;
        let prom = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });

        requests[req.id] = { resolve, reject };

        setTimeout(() => {
          delete requests[req.id];
          resolve({ body: 'timed out in 10 seconds', status: 404, headers: [] });
        }, 10000);

        let url = new URL('http://localhost:' + req.params.port + req.url.pathname.slice(7)).href;
        console.log(url);

        this.net.channel.postMessage({
          type: 'HTTP_REQUEST',
          url: url,
          port: req.params.port,
          method: req.method,
          headers: [...req.headers.entries()],
          requestId: req.id,
          referrer: req.referrer,
        });

        try {
          let { body, status, headers } = await prom;
          this.console.log('result', { body, status, headers });
          return res(
            ctx.set(Object.fromEntries(headers)),
            ctx.body(body),
            ctx.status(status),
            ctx.set('Cross-Origin-Embedder-Policy', 'require-corp'),
          );
        } catch (e) {
          return res(ctx.text(e.message));
        }
      }),
      rest.post('/~deno/op/sync/:id', async (req, res, ctx) => {
        let id = JSON.parse(req.body as string);
        try {
          let result = this.opSync(req.params.id, id[1], id[2]);
          return res(ctx.json(result ?? null));
        } catch (e) {
          if (e instanceof ApiError) {
            console.log(e.code);
            let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
            console.log('error code', getCode);
            return res(
              ctx.json({
                $err_class_name: getCode[0],
                code: getCode[1],
              }),
            );
          }
          throw e;
        }
      }),
    );

    this.console.log(import.meta);

    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/deno-sw.js',
      },
    });
  }

  static async create() {
    let kernel = new Kernel();
    kernel.init();
    kernel.fs = new VirtualFileSystem();
    return kernel;
  }

  private _ops: Op[];

  protected get ops() {
    return this._ops;
  }
}

export class RemoteKernel extends Kernel {
  proxy: Remote<Kernel>;

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

  static connect(endpoint: any) {
    let kernel = new RemoteKernel();
    kernel.proxy = proxy(endpoint);
    kernel.fs = new VirtualFileSystem();
    return kernel;
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

interface IKernel {}

class ConsoleLogResource extends Resource {
  name = 'console';
  async read(data: Uint8Array) {
    return 0;
  }
  async write(data: Uint8Array) {
    let str = new TextDecoder().decode(data);
    // console.log(str);
    console.log(str);
    return data.length;
  }
  close() {
    //
  }
  shutdown() {
    return Promise.resolve();
  }
}

class TextDecoderResource extends Resource {
  decoder = new TextDecoder();

  close() {}

  decode(data: Uint8Array) {
    return this.decoder.decode(data);
  }
}
