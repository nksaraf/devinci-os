import Global from '../global';
import HTTPRequest from '../fs/backend/HTTPRequest';
import { createInternalBindings } from './internal_binding';
import type { Kernel } from '../kernel';

// polyfilling buffer
import * as buffer from 'buffer';
import { createFileSystemBackend } from '../fs/create-fs';

export class NodeHost {
  kernel: Kernel;
  fs: typeof import('fs');
  constructor() {
    this.require = this.require.bind(this);
    this.resolve = this.resolve.bind(this);
  }
  private moduleCache: Map<string, any>;
  private globalProxy: typeof globalThis;
  private primordials: any = {};
  private getInternalBinding;
  private internalUrl: string;
  async bootstrapFromHttp(kernel: Kernel) {
    let httpFS = await createFileSystemBackend(HTTPRequest, {
      index: `/node/index.json`,
      baseUrl: '/node/',
      preferXHR: true,
    });

    kernel.fs.mount('/@node', httpFS);
    this.bootstrap(kernel, '/@node');
  }
  async bootstrap(kernel: Kernel, src = '/@node') {
    // nodeConsole = Object.assign({}, console, {
    //   log: (...args) => {
    //     this.kernel.process.stdout.writeString(args.join(' ') + '\n');
    //   }
    // })

    this.kernel = kernel;

    this.internalUrl = src;

    this.globalProxy = new Proxy({} as any, {
      has: () => true,
      get: (o, k) => (k in o ? o[k] : globalThis[k]),
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    });

    this.getInternalBinding = createInternalBindings(kernel);

    // globals that remain same for all requires
    Object.assign(this.globalProxy, {
      process: process,
      require: this.require,
      console,
      global: this.globalProxy,
      primordials: this.primordials,
      getInternalBinding: this.getInternalBinding,
    });

    this.moduleCache = new Map<string, any>();

    // patching some things we dont want to have Node load for us
    this.moduleCache.set(`${this.internalUrl}/buffer.js`, buffer);
    this.moduleCache.set(`${this.internalUrl}/internal/console/global.js`, console);
    this.moduleCache.set(`${this.internalUrl}/v8.js`, {});

    this.require('internal/per_context/primordials');
    console.log(this.primordials);

    let loadersExport = this.require('internal/bootstrap/loaders');
    Object.assign(this.globalProxy, {
      internalBinding: loadersExport.internalBinding,
    });

    // left see if we can avoid this for now, and just require core node modules as required and run that code
    // Node.require('internal/bootstrap/node');

    // load filesystem for others to use
    this.fs = this.require('fs');
    this.require('stream');
  }

  require(fileName: string) {
    const __filename = this.resolve(fileName);
    // console.log(__filename);

    if (this.moduleCache.has(__filename || fileName))
      return this.moduleCache.get(__filename || fileName);

    if (!__filename) throw new Error(`File not found ${JSON.stringify(fileName)}`);

    let result = this.loadModule(__filename);
    return result;
  }

  private loadModule(__filename: string) {
    let contents = this.kernel.fs.readFileSync(__filename, 'utf-8', 'r');

    let result = this.eval(contents);
    console.log(__filename, result);

    this.moduleCache.set(__filename, result);
    return result;
  }

  resolve(fileName: string) {
    return `${this.internalUrl}/${fileName}.js`;
  }

  eval(source: string) {
    const module = { exports: {} };
    const exports = module.exports;

    Object.assign(this.globalProxy, {
      module,
      exports,
      __filename: '',
      __dirname: '',
      window: undefined,
      globalThis: this.globalProxy,
      importScripts: undefined,
    });

    const moduleProxy = new Proxy(
      { module },
      {
        has: () => true,
        get: (o, k) => (k in o ? o[k] : this.globalProxy[k]),
        set: (o, k, v) => {
          o[k] = v;
          return true;
        },
      },
    );

    const evalWithContext = Function(`
      return (global) => {
          try {
              with (global) {
                ${source}
              }
          }  catch(e) {
            throw e;
          } finally {
            
          }
      }
    `)();

    // try {
    let result = evalWithContext(moduleProxy);

    if (result != undefined) {
      return result;
    }
    // } catch (e) {
    // // console.log(e);
    // throw e;
    // }

    return module.exports;
  }
}

Global.Node = this;
