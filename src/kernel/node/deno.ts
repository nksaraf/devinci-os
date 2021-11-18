import Global from '../global';
import HTTPRequest from '../fs/backend/HTTPRequest';
import type { Kernel } from '../kernel';
import { createFileSystemBackend } from '../fs/create-fs';
import * as path from 'path';
import { constants } from '../kernel/constants';
import { DenoHost } from './deno-host';
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';

export type Context = typeof globalThis;

class DenoIsolate {
  constructor(public context: Context, public host: DenoHost) {}

  bootstrap(options: {}) {
    this.context.bootstrap.mainRuntime({
      target: 'arm64-devinci-darwin-dev',
      location: window.location.href,
      ...options,
    });
  }

  async eval(source: string) {
    return await evalAsyncWithContext(source, this.context);
  }

  async run(path: string, options: {} = {}) {
    this.bootstrap({
      ...options,
    });
    return await this.eval(await (await fetch(path)).text());
  }
}

export class DenoRuntime {
  static async bootstrapFromHttp(kernel: Kernel) {
    let testFS = await createFileSystemBackend(HTTPRequest, {
      baseUrl: 'http://localhost:8999/',
      index: 'http://localhost:8999/index.json',
      preferXHR: true,
    });

    if (!kernel.fs.existsSync('/lib')) {
      kernel.fs.mkdirSync('/lib', 0x644, { recursive: true });
    }

    kernel.fs.mount('/lib/deno', testFS);
    return DenoRuntime.createIsolate();
  }

  static createIsolate() {
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

      SharedArrayBuffer: class {
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

    let host = new DenoHost();

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
        core: host.core,
      },
    });

    // @ts-ignore
    denoGlobal.globalThis = denoGlobal;
    // @ts-ignore
    denoGlobal.global = denoGlobal;

    // core
    DenoRuntime.evalBootstrapModule('/lib/deno/core', globalContext);

    // extensions
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/console', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/webidl', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/url', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/web', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/fetch', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/websocket', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/webstorage', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/net', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/timers', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/crypto', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/broadcast_channel', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/ffi', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/http', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/tls', globalContext);
    DenoRuntime.evalBootstrapModule('/lib/deno/ext/webgpu', globalContext);

    // Deno runtime + Web globals (lot of them are coming from utilities)
    DenoRuntime.evalBootstrapModule('/lib/deno/runtime/js', globalContext);

    host.syncOpsCache();

    return new DenoIsolate(globalContext, host);
  }

  private static evalBootstrapModule(src: string, context) {
    kernel.fs.readdirSync(src).forEach((path) => {
      if (path.endsWith('.js') && !Number.isNaN(Number(path[0]))) {
        DenoRuntime.evalBootstrapScript(`${src}/${path}`, context);
      }
    });
  }

  static async evalBootstrapScript(src, context) {
    console.time('evaluating ' + src);
    evalWithContext(kernel.fs.readFileSync(src, 'utf-8', constants.fs.O_RDONLY), context);
    console.timeEnd('evaluating ' + src);
  }
}

class Linker {
  private moduleCache: Map<string, any>;
  esbuild: typeof import('esbuild-wasm');
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
      let a = path.join(context.__dirname, fileName + '.js');
      if (kernel.fs.existsSync(a)) {
        return a;
      } else {
        return path.join(context.__dirname, fileName, 'index.js');
      }
    }
  }

  async init() {
    this.moduleCache = new Map<string, any>();
    this.esbuild = await import('esbuild-wasm');
    console.log(this.esbuild);
    await this.esbuild.initialize({
      wasmURL: esbuildWasmUrl,
      worker: true,
    });

    // let result = await this.esbuild.transform(
    //   `import {
    //       ensureFile,
    //       ensureFileSync,
    //     } from "https://deno.land/std@0.115.0/fs/mod.ts";

    //     ensureFile("./folder/targetFile.dat"); // returns promise
    //     ensureFileSync("./folder/targetFile.dat"); // void`,
    //   {
    //     format: 'cjs',
    //   },
    // );

    // console.log(result.code);
  }

  loadModule(fileName: string, context: Context) {
    let contents = kernel.fs.readFileSync(fileName, 'utf-8', constants.fs.O_RDONLY);

    let result = evalCommonJSModule(contents, {
      filename: fileName,
      globalContext: context,
      require: this.require.bind(this),
    });

    this.moduleCache.set(fileName, result);
    return result;
  }
}

function evalCommonJSModule(source: string, { filename = '', require, globalContext }) {
  const module = { exports: {} };
  const exports = module.exports;

  // function require(mod) {
  //   return this.require(mod, moduleProxy);
  // }

  const moduleProxy = new Proxy(
    {
      module,
      exports,
      __filename: filename,
      __dirname: path.dirname(filename),
      globalThis: globalContext,
      require,
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
