import Global from '../global';
import HTTPRequest from '../fs/backend/HTTPRequest';
import { createInternalBindings } from './internal_binding';
import type { Kernel } from '../kernel';
import { createFileSystemBackend } from '../fs/create-fs';
import * as path from 'path';
import { constants } from '../kernel/constants';

type Context = typeof globalThis;

export class NodeHost {
  kernel: Kernel;
  fs: typeof import('fs');
  constructor() {
    this.require = this.require.bind(this);
    this.resolve = this.resolve.bind(this);
  }
  private moduleCache: Map<string, any>;
  public globalProxy: Context;
  private primordials: any = {};
  private getInternalBinding;
  private internalUrl: string;
  setInternalModule(moduleName: string, mod: any) {
    this.moduleCache.set(`${this.internalUrl}/${moduleName}.js`, mod);
  }
  async bootstrapFromHttp(kernel: Kernel) {
    // let httpFS = await createFileSystemBackend(HTTPRequest, {
    //   index: `/node/index.json`,
    //   baseUrl: '/node/',
    //   preferXHR: true,
    // });

    let testFS = await createFileSystemBackend(HTTPRequest, {
      baseUrl: 'http://localhost:5000/',
      index: 'http://localhost:5000/index.json',
      preferXHR: true,
    });

    kernel.fs.mount('/@node-tests', testFS);
    this.bootstrap(kernel, '/@node-tests/lib');
  }

  runTest(testName: string) {
    const file = `/@node-tests/test/parallel/test-${testName}.js`;
    console.time('testing ' + testName);
    this.loadModule(file);
    console.timeEnd('testing ' + testName);
  }

  global = {};

  async bootstrap(kernel: Kernel, src = '/@node') {
    // nodeConsole = Object.assign({}, console, {
    //   log: (...args) => {
    //     this.kernel.process.stdout.writeString(args.join(' ') + '\n');
    //   }
    // })
    this.global = {
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

      SharedArrayBuffer: ArrayBuffer,
      // Atomics,

      decodeURI,
      decodeURIComponent,
      encodeURI,
      encodeURIComponent,
    };

    this.kernel = kernel;

    this.internalUrl = src;

    this.globalProxy = new Proxy(this.global as any, {
      has: (o, k) => k in o || k in this.global,
      get: (o, k) => {
        let key = o[k];
        return o[k] ?? {};
      },
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    });

    // @ts-ignore
    this.global.globalThis = this.global;

    this.getInternalBinding = createInternalBindings(this);

    // globals that remain same for all requires
    Object.assign(this.globalProxy, {
      process: process,
      console,
      primordials: this.primordials,
      getInternalBinding: this.getInternalBinding,
      window: undefined,
      importScripts: undefined,
      markBootstrapComplete: () => {
        console.log('bootstrap complete');
      },
    });

    this.moduleCache = new Map<string, any>();

    // patching some things we dont want to have Node load for us
    // this.moduleCache.set(`${this.internalUrl}/buffer.js`, buffer);
    this.moduleCache.set(`${this.internalUrl}/internal/console/global.js`, console);
    this.moduleCache.set(`${this.internalUrl}/v8.js`, {});

    this.require('internal/per_context/primordials', this.globalProxy);

    let loadersExport = this.require('internal/bootstrap/loaders', this.globalProxy);

    Object.assign(this.globalProxy, {
      internalBinding: loadersExport.internalBinding,
    });

    // left see if we can avoid this for now, and just require core node modules as required and run that code
    this.require('internal/bootstrap/node', this.globalProxy);

    // load filesystem for others to use
    loadersExport.NativeModule.map.set('fs', this.require('fs'));
    loadersExport.NativeModule.map.set('net', this.require('net'));
    loadersExport.NativeModule.map.set('os', this.require('os'));
    loadersExport.NativeModule.map.set('http', this.require('http'));
    loadersExport.NativeModule.map.set('crypto', this.require('crypto'));
    loadersExport.NativeModule.map.set('child_process', this.require('child_process'));
    loadersExport.NativeModule.map.set('wasi', this.require('wasi'));

    this.require('internal/bootstrap/environment');
  }

  require(moduleName: string, context: any = this.globalProxy) {
    const fileName = this.resolve(moduleName, context);

    if (this.moduleCache.has(fileName || moduleName))
      return this.moduleCache.get(fileName || moduleName);

    if (!fileName) throw new Error(`File not found ${JSON.stringify(moduleName)}`);

    let result = this.loadModule(fileName);
    return result;
  }

  private loadModule(fileName: string) {
    let contents = this.kernel.fs.readFileSync(fileName, 'utf-8', constants.fs.O_RDONLY);

    let result = this.evalModule(contents, { filename: fileName });

    this.moduleCache.set(fileName, result);
    return result;
  }

  resolve(fileName: string, context: Context) {
    if (fileName.startsWith('.')) {
      let a = path.join(context.__dirname, fileName + '.js');
      if (this.kernel.fs.existsSync(a)) {
        return a;
      } else {
        return path.join(context.__dirname, fileName, 'index.js');
      }
    }
    return `${this.internalUrl}/${fileName}.js`;
  }

  evalModule(source: string, { filename = '' }) {
    const module = { exports: {} };
    const exports = module.exports;

    function require(mod) {
      return this.require(mod, moduleProxy);
    }
    const moduleProxy = new Proxy(
      {
        module,
        exports,
        __filename: filename,
        __dirname: path.dirname(filename),
        globalThis: this.globalProxy,
        require: require.bind(this),
        global: this.globalProxy,
      },
      {
        has: (o, k) => k in o || k in this.globalProxy,
        get: (o, k) => (k in o ? o[k] : this.globalProxy[k]),
        set: (o, k, v) => {
          o[k] = v;
          return true;
        },
      },
    );

    let result = this.evalWithContext(source, moduleProxy as Context);

    if (result != null) {
      return result;
    }

    return module.exports;
  }

  evalWithContext(source, context = this.globalProxy) {
    const executor = Function(`
    return (context) => {
        try {
            with (context) {
              ${source}
            }
        }  catch(e) {
          throw e;
        } finally {
          
        }
    }
  `)();

    return executor(context);
  }
}

Global.Node = this;
