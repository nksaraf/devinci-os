import Global from '../global';
import HTTPRequest from '../fs/backend/HTTPRequest';
import { createInternalBindings } from './internal_binding';
import type { Kernel } from '../kernel';
import { createFileSystemBackend } from '../fs/create-fs';
import * as path from 'path';
import { constants } from '../kernel/constants';
import type { ResourceTable } from './interface';
import { Resource } from './interface';

type Context = typeof globalThis;

export class DenoRuntime {
  kernel: Kernel;
  resourceTable: ResourceTable;
  constructor() {
    this.require = this.require.bind(this);
    this.resolve = this.resolve.bind(this);
  }
  private moduleCache: Map<string, any>;
  public globalProxy: Context;
  private internalUrl: string;
  setInternalModule(moduleName: string, mod: any) {
    this.moduleCache.set(`${this.internalUrl}/${moduleName}.js`, mod);
  }

  async bootstrapFromHttp(kernel: Kernel) {
    let testFS = await createFileSystemBackend(HTTPRequest, {
      baseUrl: 'http://localhost:8999/',
      index: 'http://localhost:8999/index.json',
      preferXHR: true,
    });

    if (!kernel.fs.existsSync('/lib')) {
      kernel.fs.mkdirSync('/lib', 0x644, { recursive: true });
    }

    kernel.fs.mount('/lib/deno', testFS);
    this.bootstrap(kernel, '/lib/deno');
  }

  runTest(testName: string) {
    const file = `/lib/node/test/parallel/test-${testName}.js`;
    console.time('testing ' + testName);
    this.loadModule(file);
    console.timeEnd('testing ' + testName);
  }

  global = {};

  addResource(res: Resource) {
    let rid = this.nextRid++;
    this.resourceTable.set(rid, res);
    return rid;
  }

  nextRid = 0;

  async bootstrap(kernel: Kernel, src = '/lib/deno') {
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
        return o[k] ?? undefined;
      },
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    });

    // @ts-ignore
    this.global.globalThis = this.global;

    this.resourceTable = new Map<number, Resource>();

    class StreamResource extends Resource {
      constructor(public stream: ReadableStream) {
        super();
      }
      read(data: Uint8Array) {
        const reader = this.stream.getReader({
          mode: 'byob',
        });
        return reader.read(data);
      }
      write(data: Uint8Array) {
        return this.stream.write(data);
      }
      close() {
        this.stream.close();
      }
      shutdown() {
        return this.stream.close();
      }
    }

    let ops = [
      {
        name: 'INTERNAL',
        sync: () => {},
        async: () => {},
      }, //undefined, reserved for Deno
      {
        name: 'op_cwd',
        sync: () => {},
        async: () => {},
      },
      {
        name: 'op_read',

        sync: () => {},
        async: (rid: number, data: Uint8Array) => {
          let resource = this.resourceTable.get(rid);
          return resource.read(data);
        },
      },

      {
        name: 'op_read_dir_async',
        sync: () => {},
        async: async () => {
          return ['hello.txt'];
        },
      },
      {
        name: 'op_format_file_name',
        sync: (arg) => arg,
        async: async (arg) => {
          return arg;
        },
      },
      {
        name: 'op_url_parse',
        sync: (arg) => {
          let url = new URL(arg);
          return [
            url.href,
            url.hash,
            url.host,
            url.hostname,
            url.origin,
            url.password,
            url.pathname,
            url.port,
            url.protocol,
            url.search,
            url.username,
          ].join('\n');
        },
        async: async (arg) => {
          return arg;
        },
      },
      {
        name: 'op_fetch',
        sync: (arg) => {
          // return fetch(arg.url, {
          //   headers: arg.headers,
          //   method: arg.method,
          // });
          let requestRid = this.addResource(new Resource());

          return { requestRid, requestBodyRid: null, cancelHandleRid: null };
        },
        async: async (arg) => {
          return arg;
        },
      },

      {
        name: 'op_fetch_send',
        // sync: (arg) => {
        //   // return fetch(arg.url, {
        //   //   headers: arg.headers,
        //   //   method: arg.method,
        //   // });
        //   let requestRid = this.addResource(new Resource());

        //   return { requestRid, requestBodyRid: null };
        // },
        async: async (rid) => {
          let httpRequest = this.resourceTable.get(rid);
          let response = await fetch(httpRequest.url, httpRequest.options);

          let reader = response.body.getReader();

          let stream = new ReadableStream({
            type: 'bytes' as const,
            async pull(controller) {
              let read = reader.read();
              read.then(({ done, value }) => {
                if (done) {
                  controller.close();
                }

                controller.enqueue(value);
              });
            },
          });

          return {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            url: response.url,
            responseRid: this.addResource(new Resource(response)),
          };
        },
      },
    ];

    let Deno = {
      core: {
        opcallSync: (index, arg1, arg2) => {
          if (index === 0) {
            return ops.map((o, index) => [o.name, index]).slice(1);
          }

          let opResult = ops[index].sync(arg1, arg2);
          console.log('opcall sync', ops[index].name, opResult);

          return opResult;
        },
        opcallAsync: (index, promiseId, arg1, arg2) => {
          if (index === 0) {
            return ops.map((o, index) => [o.name, index]).slice(1);
          }
          return ops[index].async(arg1, arg2);
        },
        callConsole: (oldLog, newLog, ...args) => {
          if (args[0].startsWith('op ')) {
            if (ops.find((o) => o.name === args[1])) {
              console.log(...args);
            } else {
              console.error(...args);
            }
          } else {
            console.log(...args);
          }
        },
        setMacrotaskCallback: (cb) => {
          console.log('macrostask callback');
        },
        setWasmStreamingCallback: (cb) => {
          console.log('wasm streaming callback');
        },
      },
    };

    // globals that remain same for all requires
    Object.assign(this.globalProxy, {
      // process: process,
      console,
      // primordials: this.primordials,
      // getInternalBinding: this.getInternalBinding,
      // window: undefined,
      // importScripts: undefined,
      // markBootstrapComplete: () => {
      // console.log('bootstrap complete');
      // },

      Deno: Deno,
    });

    Global.deno = this.globalProxy;

    this.moduleCache = new Map<string, any>();

    // kernel.fs.mount(
    //   '/deno',
    //   await createFileSystemBackend(HTTPRequest, {
    //     baseURL: 'https://raw.githubusercontent.com/denoland/deno/main/runtime/js/',
    //   }),
    // );

    this.evalScript('/lib/deno/core/00_primordials.js');
    this.evalScript('/lib/deno/core/01_core.js');
    this.evalScript('/lib/deno/core/02_error.js');

    Deno.core.syncOpsCache();

    // this.evalScript('/lib/deno/runtime/js/01_build.js');
    // this.evalScript('/lib/deno/runtime/js/01_errors.js');
    // this.evalScript('/lib/deno/runtime/js/01_version.js');
    // this.evalScript('/lib/deno/runtime/js/01_web_util.js');

    this.evalExtension('/lib/deno/ext/console');
    this.evalExtension('/lib/deno/ext/webidl');
    this.evalExtension('/lib/deno/ext/url');
    this.evalExtension('/lib/deno/ext/web');
    this.evalExtension('/lib/deno/ext/fetch');
    this.evalExtension('/lib/deno/ext/websocket');
    this.evalExtension('/lib/deno/ext/webstorage');
    this.evalExtension('/lib/deno/ext/net');
    this.evalExtension('/lib/deno/ext/timers');
    this.evalExtension('/lib/deno/ext/crypto');
    this.evalExtension('/lib/deno/ext/broadcast_channel');
    this.evalExtension('/lib/deno/ext/ffi');
    this.evalExtension('/lib/deno/ext/http');
    this.evalExtension('/lib/deno/ext/tls');
    this.evalExtension('/lib/deno/ext/webgpu');

    this.evalExtension('/lib/deno/runtime/js');

    this.globalProxy.bootstrap.mainRuntime({
      target: 'unknown',
    });

    Global.Deno = this.globalProxy.Deno;

    this.evalAsyncWithContext(`for await (const dirEntry of Deno.readDir('data')) {
      console.log(dirEntry);
    }
      
      let response = await fetch("https://api.github.com/users/denoland");
      console.log(await response.json());

    `);

    // this.evalScript('/lib/deno/runtime/js/06_util.js');
    // this.evalScript('/lib/deno/runtime/js/10_permissions.js');

    // patching some things we dont want to have Node load for us
    // this.moduleCache.set(`${this.internalUrl}/buffer.js`, buffer);
    // this.moduleCache.set(`${this.internalUrl}/internal/console/global.js`, console);
    // this.moduleCache.set(`${this.internalUrl}/v8.js`, {});

    // this.require('internal/per_context/primordials', this.globalProxy);

    // let loadersExport = this.require('internal/bootstrap/loaders', this.globalProxy);

    // Object.assign(this.globalProxy, {
    //   internalBinding: loadersExport.internalBinding,
    // });

    // // left see if we can avoid this for now, and just require core node modules as required and run that code
    // this.require('internal/bootstrap/node', this.globalProxy);

    // // load filesystem for others to use
    // loadersExport.NativeModule.map.set('fs', this.require('fs'));
    // loadersExport.NativeModule.map.set('net', this.require('net'));
    // loadersExport.NativeModule.map.set('os', this.require('os'));
    // loadersExport.NativeModule.map.set('http', this.require('http'));
    // loadersExport.NativeModule.map.set('crypto', this.require('crypto'));
    // loadersExport.NativeModule.map.set('child_process', this.require('child_process'));
    // loadersExport.NativeModule.map.set('wasi', this.require('wasi'));

    // this.require('internal/bootstrap/environment');
  }

  private evalExtension(src: string) {
    kernel.fs.readdirSync(src).forEach((path) => {
      if (path.endsWith('.js')) {
        this.evalScript(`${src}/${path}`);
      }
    });
  }

  private evalScript(src) {
    this.evalWithContext(kernel.fs.readFileSync(src, 'utf-8', constants.fs.O_RDONLY));
    console.log('evaluated', src);
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
              let fn = function() {
                ${source}
              }

              boundFn = fn.bind(context);

              return boundFn();
            }
        }  catch(e) {
          throw e;
        } finally {
          
        }
    };
  `)();

    return executor.bind(context)(context);
  }

  evalAsyncWithContext(source, context = this.globalProxy) {
    const executor = Function(`
    return (context) => {
        try {
            with (context) {
              let fn = async function() {
                ${source}
              }

              boundFn = fn.bind(context);

              return boundFn();
            }
        }  catch(e) {
          throw e;
        } finally {
          
        }
    };
  `)();

    return executor.bind(context)(context);
  }
}

Global.Node = this;