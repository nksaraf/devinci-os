import HTTPRequest from '../kernel/fs/backend/HTTPRequest';
import type { VirtualFileSystem } from '../kernel/fs/create-fs';
import * as path from 'path';
import { constants } from '../kernel/kernel/constants';
import type { Kernel } from './denix/denix';
import type { Linker } from './linker/Linker';
import { mkdirp } from 'os/kernel/fs/core/util';

export type Context = typeof globalThis;

let ISOLATE_ID = 0;

//
interface IDenoCore {
  opcallSync: any;
  opcallAsync: (op_code: number, promiseId: number, arg1: any, arg2: any) => void;
  callConsole: (oldLog: any, newLog: any, ...args: any[]) => void;
  setMacrotaskCallback: (cb: any) => void;
  setWasmStreamingCallback: (cb: any) => void;
  decode: (data: Uint8Array) => string;
  encode: (data: string) => Uint8Array;
  isProxy: (v: any) => boolean;
  getProxyDetails: (v: any) => any;
  opresolve?(...args): void;
  syncOpsCache?(): void;
}

export class DenoIsolate extends EventTarget {
  id: number;
  linker: Linker;
  kernel: Kernel;
  core: IDenoCore;

  wasmStreamingCallback;
  Deno: typeof Deno;

  constructor() {
    super();

    this.core = {
      opcallSync: this.opcallSync.bind(this),
      opcallAsync: this.opcallAsync.bind(this),
      callConsole: (oldLog, newLog, ...args) => {
        console.log(...args);

        if (args[0].startsWith('op sync') || args[0].startsWith('op async')) {
          return;
        }

        this.kernel.dispatchEvent(new CustomEvent('console', { detail: args.toString() }));
        // newLog(...args)
        // newLog(...args);
        // this.dispatchEvent(
        //   new CustomEvent('stdout', {
        //     detail: [...args.filter((a) => !(a instanceof Uint8Array))],
        //   }),
        // );
      },
      setMacrotaskCallback: (cb) => {
        console.log('macrostask callback');
      },
      setWasmStreamingCallback: (cb) => {
        this.wasmStreamingCallback = cb;
      },
      decode: function (data: Uint8Array) {
        console.log(data);
        return new TextDecoder().decode(new Uint8Array(data));
      },
      encode: function (data: string) {
        return new TextEncoder().encode(data);
      },
      isProxy: function (obj) {
        return false;
      },
      getProxyDetails: function (obj) {
        return null;
      },
    };

    this.id = ISOLATE_ID++;
  }

  public context: Context;

  opcallSync(op_code: number, arg1: any, arg2: any) {
    return this.kernel.opSync(op_code, arg1, arg2);
  }

  opcallAsync(...args: Parameters<Kernel['opAsync']>) {
    this.kernel.opAsync(...args).then((value) => {
      this.core.opresolve(args[1], value);
    });
  }

  async attach(kernel: Kernel) {
    this.kernel = kernel;

    let context = await loadDenoBootstrapper(this.core, kernel.fs);

    this.context = context;

    this.core.syncOpsCache();

    // this.host.setOpsResolve(this.id);
    await context.bootstrap.mainRuntime({
      target: 'arm64-devinci-darwin-dev',
      debugFlag: true,
      noColor: false,
      args: [],
      // location: window.location.href,
      // ...options,
    });

    this.Deno = this.context.Deno;

    Object.assign(this.context, {
      WebAssembly: {
        compileStreaming: async (source) => {
          let res = await source;
          return await WebAssembly.compileStreaming(fetch(res.url));
        },
        Instance: WebAssembly.Instance,
        instantiate: WebAssembly.instantiate,
        instantiateStreaming: WebAssembly.instantiateStreaming,
        compile: WebAssembly.compile,
      },
    });
  }

  async eval(source: string, options: {} = {}) {
    return await this.linker.eval(source, this.context);
  }

  async run(
    path: string,
    options: {
      args?: string[];
    } = {},
  ) {
    if (path.endsWith('.wasm')) {
      return await this.runWASM(path, options);
    }

    const script = await new Function(`return async () => {
      return await import("${path}?script")
    }`)()();

    return;
  }

  public async runWASM(path: string, options: { args?: string[] }) {
    const { default: Context } = await import(
      'https://deno.land/std@0.115.1/wasi/snapshot_preview1.ts'
    );

    const context = new Context({
      args: [path, ...(options.args ?? [])],
      env: Deno.env.toObject(),
      exitOnReturn: false,
      preopens: {
        '/lib': '/lib',
        '/lib/deno': '/lib/deno',
      },
    });

    const wasm = await WebAssembly.compileStreaming(fetch(path));

    let instance = await WebAssembly.instantiate(wasm, {
      wasi_snapshot_preview1: context.exports,
      wasi_unstable: context.exports,
    });

    await context.start(instance);
    return;
  }
}

type DenoBootstrapCore = any;

import.meta.main = true;

// this assums that mountDenoLib was run on the file system so that /lib/deno is available
async function loadDenoBootstrapper(core: DenoBootstrapCore, fs: VirtualFileSystem) {
  async function evalBootstrapModule(src: string, context) {
    let files = await fs.readdir(src);

    for (let path of files) {
      if (path.endsWith('.js') && !Number.isNaN(Number(path[0]))) {
        await evalScript(`${src}/${path}`, context);
      }
    }
  }

  async function evalScript(src, context) {
    console.time('evaluating ' + src);
    let rv = await fs.readFile(src, 'utf-8', constants.fs.O_RDONLY);
    evalWithContext(rv, context);
    console.timeEnd('evaluating ' + src);
  }

  let denoGlobal = getGlobalThis(core);

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

  // @ts-ignore
  denoGlobal.globalThis = denoGlobal;
  // @ts-ignore
  denoGlobal.global = denoGlobal;

  // core
  await evalBootstrapModule('/lib/deno/core', globalContext);

  // extensions
  await evalBootstrapModule('/lib/deno/ext/console', globalContext);
  await evalBootstrapModule('/lib/deno/ext/webidl', globalContext);
  await evalBootstrapModule('/lib/deno/ext/url', globalContext);
  await evalBootstrapModule('/lib/deno/ext/web', globalContext);
  await evalBootstrapModule('/lib/deno/ext/fetch', globalContext);
  await evalBootstrapModule('/lib/deno/ext/websocket', globalContext);
  await evalBootstrapModule('/lib/deno/ext/webstorage', globalContext);
  await evalBootstrapModule('/lib/deno/ext/net', globalContext);
  await evalBootstrapModule('/lib/deno/ext/timers', globalContext);
  await evalBootstrapModule('/lib/deno/ext/crypto', globalContext);
  await evalBootstrapModule('/lib/deno/ext/broadcast_channel', globalContext);
  await evalBootstrapModule('/lib/deno/ext/ffi', globalContext);
  await evalBootstrapModule('/lib/deno/ext/http', globalContext);
  await evalBootstrapModule('/lib/deno/ext/tls', globalContext);
  await evalBootstrapModule('/lib/deno/ext/webgpu', globalContext);

  // Deno runtime + Web globals (lot of them are coming from utilities)
  await evalBootstrapModule('/lib/deno/runtime/js', globalContext);

  return globalContext as Context;
}

function getGlobalThis(core: any) {
  return {
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

    console,
    // original deno global comes from host
    // this will be overwitten by the runtime
    Deno: {
      core: core,
    },
  };
}

export async function mountDenoLib(fs: VirtualFileSystem) {
  console.log('heree');
  let testFS = await HTTPRequest.Create({
    baseUrl: 'http://localhost:8999/',
    index: 'http://localhost:8999/index.json',
    preferXHR: true,
  });
  console.log('heree');

  if (!(await fs.exists('/lib'))) {
    await mkdirp('/lib', 0x644, fs);
  }
  console.log('heree');

  fs.mount('/lib/deno', testFS);

  console.log('heree done', await fs.readdir('/lib/deno'));
}

export function getModuleFn(
  source: string,
  { url = '', require, globalContext, mode = 'module' as 'module' | 'script' },
): () => any | Promise<any> {
  const module = { exports: {} };
  const exports = module.exports;

  const requireFn = (mod) => {
    return require(mod, moduleProxy);
  };

  const moduleProxy = new Proxy(
    {
      module,
      exports,
      __filename: url,
      __dirname: path.dirname(url),
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

  if (mode === 'module' && isModule(mode)) {
    return () => {
      let result = evalWithContext(source, moduleProxy as Context);

      if (result != null) {
        return result;
      }

      return module.exports;
    };
  } else {
    return async () => {
      let result = getEvalAsyncFunction(source, moduleProxy as Context)();

      return await result;
    };
  }
}

let isModule = (p: 'module'): p is 'module' => true;

function evalWithContext(source, context) {
  return getEvalSyncFn(source, context)();
}

function getEvalSyncFn(source, context) {
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
        console.error('Error thrown from eval', e);
        throw e;
      }
    };
  `)();

  return () => {
    executor.bind(context)(context);
  };
}

export function getEvalAsyncFunction(source, context) {
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

  return async () => {
    return await executor.bind(context)(context);
  };
}
