import Global from '../global';
import HTTPRequest from '../fs/backend/HTTPRequest';
import type { Kernel } from '../kernel';
import { createFileSystemBackend } from '../fs/create-fs';
import type { File } from '../fs/core/file';
import * as path from 'path';
import { constants } from '../kernel/constants';
import type { ResourceTable } from './interface';
import { Resource } from './interface';
import type { FileHandle } from '../vfs/file';
import { Buffer } from 'buffer';
import { FileType } from '../fs/core/stats';
type Context = typeof globalThis;

function op(
  name: string,
  execute: {
    async: Function;
    sync: Function;
  },
): Op {
  return {
    name,
    ...execute,
  };
}

function asyncOp(name: string, execute: Function): Op {
  return {
    name,
    async: execute,
    sync: execute,
  };
}

function syncOp(name: string, execute: Function): Op {
  return {
    name,
    sync: execute,
    async: execute,
  };
}

type Op = {
  name: string;
  sync?: Function;
  async?: Function;
};

class DenoHost {
  core: {
    opcallSync: (index: any, arg1: any, arg2: any) => any;
    opcallAsync: (index: any, promiseId: any, arg1: any, arg2: any) => any;
    callConsole: (oldLog: any, newLog: any, ...args: any[]) => void;
    setMacrotaskCallback: (cb: any) => void;
    setWasmStreamingCallback: (cb: any) => void;
    decode: (data: Uint8Array) => string;
    encode: (data: string) => Uint8Array;
  };

  resourceTable: ResourceTable;

  addResource(res: Resource) {
    let rid = this.nextRid++;
    this.resourceTable.set(rid, res);
    return rid;
  }
  nextRid = 0;

  constructor() {
    this.resourceTable = new Map<number, Resource>();

    this.addResource(new ConsoleLogResource());
    this.addResource(new ConsoleLogResource());
    this.addResource(new ConsoleLogResource());

    this.ops = [
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
        async: async (rid: number, data: Uint8Array) => {
          let resource = this.resourceTable.get(rid);
          return await resource.read(data);
        },
      },
      {
        name: 'op_write',
        sync: () => {},
        async: async (rid: number, data: Uint8Array) => {
          let resource = this.resourceTable.get(rid);
          return await resource.write(data);
        },
      },

      asyncOp('op_read_dir_async', async (dirPath: string) => {
        return ['hello.txt'];
      }),
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
          console.log(arg);
          let requestRid = this.addResource(
            new FetchRequestResource(
              arg.url,
              arg.method,
              arg.headers,
              arg.hasBody,
              arg.clientRid,
              arg.byteLength,
            ),
          );

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
          let httpRequest = this.resourceTable.get(rid) as FetchRequestResource;
          let response = await fetch(httpRequest.url, {
            headers: httpRequest.headers,
            method: httpRequest.method,
          });

          return {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            url: response.url,
            responseRid: this.addResource(new FetchResponseResource(response)),
          };
        },
      },

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
        name: 'op_close',
        sync: (rid) => {
          console.log('closing', rid);
          let resource = this.resourceTable.get(rid);
          resource.close();
          this.resourceTable.delete(rid);
        },
      },
      {
        name: 'op_try_close',
        sync: (rid) => {
          console.log('try closing', rid);
          let resource = this.resourceTable.get(rid);
          try {
            resource.close();
            this.resourceTable.delete(rid);
          } catch (e) {
            console.log('couldnt close', rid, resource);
          }
        },
      },
      {
        name: 'op_open_async',
        async: async (arg) => {
          let file = kernel.fs.openSync(arg.path, constants.fs.O_RDWR, arg.mode);
          console.log(file);
          return this.addResource(new FileResource(file, arg.path));
        },
      },

      asyncOp('op_fstat_async', async (rid) => {
        let file = this.resourceTable.get(rid) as FileResource;
        let stat = file.file.statSync();
        return {
          size: stat.size,
          isFile: true,
          isDirectory: false,
          isSymbolicLink: false,
        };
      }),
    ];

    this.core = {
      opcallSync: (index, arg1, arg2) => {
        // this is called when Deno.core.syncOpsCache is run
        // we have to reply with an array of [op_name, id in op_cache]]
        // Deno maintains a cache of this mapping
        // so it can call ops by passing a number, not the whole string
        if (index === 0) {
          return this.ops.map((o, index) => [o.name, index]).slice(1);
        }

        if (!this.ops[index]) {
          throw new Error(`op ${index} not found`);
        } else if (!this.ops[index].sync) {
          throw new Error(`op ${index} not sync`);
        }

        // @ts-ignore
        let opResult = this.ops[index].sync(arg1, arg2);
        console.log('opcall sync', this.ops[index].name, opResult);

        return opResult;
      },
      opcallAsync: (index, promiseId, arg1, arg2) => {
        if (index === 0) {
          return this.ops.map((o, index) => [o.name, index]).slice(1);
        }
        return this.ops[index].async(arg1, arg2);
      },
      callConsole: (oldLog, newLog, ...args) => {
        if (typeof args[0] === 'string' && args[0].startsWith('op ')) {
          if (this.ops.find((o) => o.name === args[1])) {
            console.log(...args);
          } else {
            console.error(...args);
          }
        } else {
          oldLog(...args);
          // newLog(...args);
        }
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
  }

  syncOpsCache() {
    // @ts-ignore
    this.core.syncOpsCache();
  }

  ops: Op[];
}

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

class FetchResponseResource extends Resource {
  reader: ReadableStreamDefaultReader;
  constructor(public response: Response) {
    super();
    let reader = response.body.getReader();
    // let stream = new ReadableStream({
    //   type: 'bytes' as const,
    //   async pull(controller) {
    //     let { done, value } = await reader.read();

    //     if (done) {
    //       controller.close();
    //     }

    //     controller.enqueue(value);
    //   },
    // });
    this.reader = reader;
  }
  async read(data: Uint8Array) {
    let { done, value } = await this.reader.read();

    if (done) {
      return 0;
    } else {
      data.set(value);
      console.log('READ', done, value, data);

      return value.byteLength;
    }
  }
}

class FetchRequestResource extends Resource {
  constructor(
    public url: string,
    public method: string,
    public headers: [[string, string]],
    public hasBody: boolean,
    public clientRid: number,
    public byteLength: number,
  ) {
    super();
  }
}

class TextDecoderResource extends Resource {
  decoder = new TextDecoder();

  close() {}

  decode(data: Uint8Array) {
    return this.decoder.decode(data);
  }
}

class FileResource extends Resource {
  constructor(public file: File, public name: string) {
    super();
  }

  position = 0;
  async read(data: Uint8Array) {
    if (this.position >= this.file.statSync().size) {
      return null;
    }
    let container = Buffer.from(data);
    let nread = this.file.readSync(
      container,
      0,
      Math.min(this.file.statSync().size, data.byteLength),
      0,
    );

    data.set(container, 0);

    this.position += nread;

    return nread;
  }

  async write(data: Uint8Array) {
    let container = Buffer.from(data);
    let nwritten = this.file.writeSync(
      container,
      0,
      Math.max(this.file.statSync().size, data.byteLength),
      0,
    );

    this.position += nwritten;

    return nwritten;
  }

  close() {
    this.file.closeSync();
  }
}

export class DenoRuntime {
  kernel: Kernel;
  host: DenoHost;
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

  // runTest(testName: string) {
  //   const file = `/lib/node/test/parallel/test-${testName}.js`;
  //   console.time('testing ' + testName);
  //   this.loadModule(file);
  //   console.timeEnd('testing ' + testName);
  // }

  global = {};

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

    this.kernel = kernel;

    this.internalUrl = src;

    this.host = new DenoHost();

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

    // globals that remain same for all requires
    Object.assign(this.globalProxy, {
      console,
      // original deno global comes from host
      // this will be overwitten by the runtime
      Deno: {
        core: this.host.core,
      },
    });

    Global.deno = this.globalProxy;

    this.moduleCache = new Map<string, any>();

    this.evalScript('/lib/deno/core/00_primordials.js');
    this.evalScript('/lib/deno/core/01_core.js');
    this.evalScript('/lib/deno/core/02_error.js');

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

    this.host.syncOpsCache();

    this.globalProxy.bootstrap.mainRuntime({
      target: 'arm64-devinci-darwin-dev',
      args: ['/hello.txt'],
    });

    Global.Deno = this.globalProxy.Deno;

    kernel.fs.writeFileSync(
      '/hello.txt',
      'Hello world',
      'utf-8',
      constants.fs.O_RDWR,
      FileType.FILE,
    );

    await this.evalAsyncWithContext(`
      for await (const dirEntry of Deno.readDir('data')) {
        console.log(dirEntry);
      }
      
      let response = await fetch("https://api.github.com/users/denoland");
      for await (const chunk of response.body) {
        console.log('heree', new TextDecoder().decode(chunk));
      }

      for (let i = 0; i < Deno.args.length; i++) {
        const filename = Deno.args[i];
        console.log('heree')
        let file = await Deno.open(filename)
        console.log(file)
        await Deno.stdout.write(await Deno.readAll(file))
        await Deno.writeFile('/other.txt', (await Deno.readFile('/hello.txt')).slice(0, 5))
        file.close();

        console.log(Deno.cwd())
      }
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

  async evalAsyncWithContext(source, context = this.globalProxy) {
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
        } finally {
          
        }
    };
  `)();

    return executor.bind(context)(context);
  }
}

Global.Node = this;
