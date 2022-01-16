import { constants } from '$lib/constants.ts';
import HTTPRequest from '$lib/fs/http.ts';
import { mkdirp } from '$lib/fs/utils/util.ts';
import type { VirtualFileSystem } from '$lib/fs/virtual.ts';
import * as path from 'path-browserify';
import { evalWithContext, getEvalAsyncFunction } from '../eval.ts';
import { FileIndex } from '../fs/core/file_index.ts';
import type { Context } from './isolate.ts';

type DenoBootstrapCore = any;
// this assums that mountDenoLib was run on the file system so that /lib/deno is available
export async function loadDenoRuntime(core: DenoBootstrapCore, fs: VirtualFileSystem) {
  async function evalBootstrapModule(src: string, context) {
    let files = await fs.readdir(src);
    files.sort();
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
  // await evalBootstrapModule('/lib/deno/core', globalContext);

  // // extensions
  // await evalBootstrapModule('/lib/deno/ext/console', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/webidl', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/url', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/web', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/fetch', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/websocket', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/webstorage', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/net', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/timers', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/crypto', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/broadcast_channel', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/ffi', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/http', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/tls', globalContext);
  // await evalBootstrapModule('/lib/deno/ext/webgpu', globalContext);

  // // Deno runtime + Web globals (lot of them are coming from utilities)
  // await evalBootstrapModule('/lib/deno/runtime/js', globalContext);

  const { loadRuntime } = await import(`./deno_runtime.js`);
  loadRuntime(globalContext);
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
  console.time('mounted /lib/deno');
  let testFS = await HTTPRequest.Create({
    baseUrl: 'https://raw.githubusercontent.com/denoland/deno/main/',
    index: '/deno_index.json',
    preferXHR: true,
  });

  if (!(await fs.exists('/lib'))) {
    await mkdirp('/lib', 0x644, fs);
  }

  await fs.mount('/lib/deno', testFS);
  console.timeEnd('mounted /lib/deno');
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
