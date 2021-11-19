import HTTPRequest from '../kernel/fs/backend/HTTPRequest';
import { createFileSystemBackend } from '../kernel/fs/create-fs';
import * as path from 'path';
import { constants } from '../kernel/kernel/constants';
import type { Kernel } from './denix';
import { proxy, windowEndpoint, wrap } from 'comlink';
import EsbuildWorker from './esbuild-worker.ts?worker';
import { syncDownloadFile } from 'os/kernel/fs/generic/xhr';
import Global from 'os/kernel/global';
export type Context = typeof globalThis;

let ISOLATE_ID = 0;

class OpResolvedEvent extends Event {
  constructor(public readonly promiseId: number, public readonly value: any) {
    super('resolved');
  }
}

export class DenoIsolate {
  constructor() {}
  public context: Context;
  id: number;
  static async create(kernel: Kernel) {
    let core = {
      opcallSync: kernel.syncOp.bind(kernel),
      opcallAsync: (...args: Parameters<Kernel['asyncOp']>) => {
        kernel.asyncOp(...args).then((value) => {
          core.opresolve(args[1], value);
        });
      },
      callConsole: (oldLog, newLog, ...args) => {
        kernel.console.log(...args);
      },
      setMacrotaskCallback: (cb) => {
        console.log('macrostask callback');
      },
      setWasmStreamingCallback: (cb) => {
        console.log('wasm streaming callback');
      },
      decode: function (data: Uint8Array) {
        return new TextDecoder().decode(data);
      },
      encode: function (data: string) {
        return new TextEncoder().encode(data);
      },
    };

    let context = await loadDenoBootstrapper(core);

    let isolate = new DenoIsolate();
    isolate.context = context;
    isolate.id = ISOLATE_ID++;

    // @ts-ignore
    await core.syncOpsCache();
    kernel.addEventListener('op_resolve', (event: OpResolvedEvent) => {
      //@ts-ignore
      core.opresolve([event.promiseId, event.value]);
    });

    // this.host.setOpsResolve(this.id);
    context.bootstrap.mainRuntime({
      target: 'arm64-devinci-darwin-dev',
      // location: window.location.href,
      // ...options,
    });

    Global.Deno = context.Deno;

    return isolate;
  }

  async eval(source: string, options: {} = {}) {
    return await evalAsyncWithContext(source, this.context);
  }

  async run(path: string, options: {} = {}) {
    return await this.eval(await (await fetch(path)).text());
  }
}
type DenoBootstrapCore = any;

async function loadDenoBootstrapper(core: DenoBootstrapCore) {
  await mountDenoLib();

  let denoGlobal = {
    JSON,
    Math,
    Proxy,
    Reflect,

    Promise,

    AggregateError: globalThis.AggregateError,
    Array,
    ArrayBuffer,
    BigInt,
    BigInt64Array,
    BigUint64Array,
    Boolean,
    DataView,
    Date,
    Error,
    EvalError,
    FinalizationRegistry: globalThis.FinalizationRegistry,
    Float32Array,
    Float64Array,
    Function,
    Int16Array,
    Int32Array,
    Int8Array,
    Map,
    Number,
    Object,
    RangeError,
    ReferenceError,
    RegExp,
    Set,
    String,
    Symbol,
    SyntaxError,
    TypeError,
    URIError,
    Uint16Array,
    Uint32Array,
    Uint8Array,
    Uint8ClampedArray,
    WeakMap,
    WeakRef: globalThis.WeakRef,
    WeakSet,

    SharedArrayBuffer:
      crossOriginIsolated && SharedArrayBuffer
        ? SharedArrayBuffer
        : class {
            constructor() {
              throw new Error('SharedArrayBuffer is not supported');
            }
          },
    // Atomics,

    decodeURI,
    decodeURIComponent,
    encodeURI,
    encodeURIComponent,
  };

  let globalContext = new Proxy(denoGlobal as any, {
    has: (o, k) => k in o || k in denoGlobal,
    get: (o, k) => {
      return o[k] ?? undefined;
    },
    set: (o, k, v) => {
      o[k] = v;
      return true;
    },
  });

  // globals that remain same for all requires
  Object.assign(globalContext, {
    console,
    // original deno global comes from host
    // this will be overwitten by the runtime

    Deno: {
      core: core,
    },
  });

  // @ts-ignore
  denoGlobal.globalThis = denoGlobal;
  // @ts-ignore
  denoGlobal.global = denoGlobal;

  // core
  evalBootstrapModule('/lib/deno/core', globalContext);

  // extensions
  evalBootstrapModule('/lib/deno/ext/console', globalContext);
  evalBootstrapModule('/lib/deno/ext/webidl', globalContext);
  evalBootstrapModule('/lib/deno/ext/url', globalContext);
  evalBootstrapModule('/lib/deno/ext/web', globalContext);
  evalBootstrapModule('/lib/deno/ext/fetch', globalContext);
  evalBootstrapModule('/lib/deno/ext/websocket', globalContext);
  evalBootstrapModule('/lib/deno/ext/webstorage', globalContext);
  evalBootstrapModule('/lib/deno/ext/net', globalContext);
  evalBootstrapModule('/lib/deno/ext/timers', globalContext);
  evalBootstrapModule('/lib/deno/ext/crypto', globalContext);
  evalBootstrapModule('/lib/deno/ext/broadcast_channel', globalContext);
  evalBootstrapModule('/lib/deno/ext/ffi', globalContext);
  evalBootstrapModule('/lib/deno/ext/http', globalContext);
  evalBootstrapModule('/lib/deno/ext/tls', globalContext);
  evalBootstrapModule('/lib/deno/ext/webgpu', globalContext);

  // Deno runtime + Web globals (lot of them are coming from utilities)
  evalBootstrapModule('/lib/deno/runtime/js', globalContext);

  return globalContext as Context;
}

// export class DenoRuntime {
//   static bootstrapWithRemote(endpoint: any) {
//     let kernel = RemoteKernel.connect(endpoint);

//     return this.bootstrapFromHttp(kernel);
//   }
//   // static async bootstrapInWorker() {
//   //   let worker = new DenoWorker();

//   //   let host = new DenoRemoteHost(worker);

//   //   return this.bootstrapFromHttp(host);
//   // }

//   // static async bootstrapInIframe() {
//   //   let iframe = document.createElement('iframe');
//   //   iframe.style.display = 'none';
//   //   iframe.src = '/deno.html';
//   //   document.body.appendChild(iframe);
//   //   await new Promise((resolve) => {
//   //     iframe.onload = resolve;
//   //   });

//   //   let host = new DenoRemoteHost(windowEndpoint(iframe.contentWindow));

//   //   return this.bootstrapFromHttp(host);
//   // }

//   static async bootstrapFromHttp(host: Kernel) {
//     return await DenoIsolate.create(host);
//   }
// }

export class Linker {
  private moduleCache: Map<string, any>;
  esbuild = wrap<{ init: () => void; transpile: (data: SharedArrayBuffer) => void }>(
    new EsbuildWorker(),
  );
  constructor() {
    this.require = this.require.bind(this);
    this.resolve = this.resolve.bind(this);
  }

  require(moduleName: string, context: any) {
    const fileName = this.resolve(moduleName, context);

    if (this.moduleCache.has(fileName || moduleName))
      return this.moduleCache.get(fileName || moduleName);

    if (!fileName) throw new Error(`File not found ${JSON.stringify(moduleName)}`);

    let result = this.loadModule(fileName, context);
    return result;
  }

  resolve(fileName: string, context: Context) {
    if (fileName.startsWith('.')) {
      if (context.__filename.startsWith('http')) {
        let a = path.join(context.__dirname, fileName);
        return a;
      } else {
        let a = path.join(context.__dirname, fileName + '.js');
        if (fs.existsSync(a)) {
          return a;
        } else {
          return path.join(context.__dirname, fileName, 'index.js');
        }
      }
    }

    return fileName;
  }

  async init() {
    this.moduleCache = new Map<string, any>();
    await this.esbuild.init();
  }

  loadModule(fileName: string, context: Context) {
    let data = fileName.startsWith('http')
      ? syncDownloadFile(fileName, 'buffer')
      : Deno.readFileSync(fileName);

    let code = this.transpileToCJS(data);

    let result = evalCJSModule(code, {
      filename: fileName,
      globalContext: context,
      require: this.require.bind(this),
    });

    this.moduleCache.set(fileName, result);
    return result;
  }

  private transpileToCJS(data: Uint8Array) {
    const sharedBuffer = new SharedArrayBuffer(data.length * 10);

    let markers = new Int32Array(sharedBuffer, 0, 8);
    Atomics.store(markers, 0, 0);
    Atomics.store(markers, 1, data.length);

    new Uint8Array(sharedBuffer).set(data, 8);

    this.esbuild.transpile(sharedBuffer).then(console.log).catch(console.error);

    Atomics.wait(markers, 0, 0);

    let code = new TextDecoder().decode(
      new Uint8Array(
        new Uint8Array(sharedBuffer, 8, Atomics.load(new Int32Array(sharedBuffer, 0, 8), 1)),
      ),
    );
    return code;
  }
}

async function mountDenoLib() {
  let testFS = await createFileSystemBackend(HTTPRequest, {
    baseUrl: 'http://localhost:8999/',
    index: 'http://localhost:8999/index.json',
    preferXHR: true,
  });

  if (!fs.existsSync('/lib')) {
    fs.mkdirSync('/lib', 0x644, { recursive: true });
  }

  fs.mount('/lib/deno', testFS);
}

function evalBootstrapModule(src: string, context) {
  fs.readdirSync(src).forEach((path) => {
    if (path.endsWith('.js') && !Number.isNaN(Number(path[0]))) {
      evalScript(`${src}/${path}`, context);
    }
  });
}

function evalScript(src, context) {
  console.time('evaluating ' + src);
  evalWithContext(fs.readFileSync(src, 'utf-8', constants.fs.O_RDONLY), context);
  console.timeEnd('evaluating ' + src);
}

function evalCJSModule(source: string, { filename = '', require, globalContext }) {
  const module = { exports: {} };
  const exports = module.exports;

  const requireFn = (mod) => {
    return require(mod, moduleProxy);
  };

  const moduleProxy = new Proxy(
    {
      module,
      exports,
      __filename: filename,
      __dirname: path.dirname(filename),
      globalThis: globalContext,
      require: requireFn,
      global: globalContext,
    },
    {
      has: (o, k) => k in o || k in globalContext,
      get: (o, k) => (k in o ? o[k] : globalContext[k]),
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    },
  );

  let result = evalWithContext(source, moduleProxy as Context);

  if (result != null) {
    return result;
  }

  return module.exports;
}

function evalWithContext(source, context) {
  const executor = Function(`
    return (context) => {
      try {
          with (context) {
            let fn = function() {
              ${source}
            }

            // binding here so that global variable is available
            // as this to the top level iife type functions
            boundFn = fn.bind(context);

            return boundFn();
          }
      }  catch(e) {
        throw e;
      }
    };
  `)();

  return executor.bind(context)(context);
}

function evalAsyncWithContext(source, context) {
  const executor = Function(`
    return async (context) => {
      try {
          with (context) {
            let fn = async function() {
              ${source}
            }

            boundFn = fn.bind(context);

            return await boundFn();
          }
      }  catch(e) {
        throw e;
      }
    };
  `)();

  return executor.bind(context)(context);
}
