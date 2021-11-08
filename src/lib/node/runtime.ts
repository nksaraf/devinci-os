import { FileFlag } from '../fs/core/file_flag';
import type { FileSystem } from '../fs/core/file_system';
import * as buffer from 'buffer';
import Global from '../global';
import type * as FS from 'fs';
import { createInternalBindings } from './internal_binding';

export class Kernel {
  fs: FileSystem;
}

export class Node {
  static kernel: Kernel;
  static fs: typeof FS;
  static globalProxy: typeof globalThis;
  static moduleCache: Map<string, any>;
  static primordials: any = {};
  static getInternalBinding;
  static bootstrap(kernel: Kernel) {
    Node.kernel = kernel;
    Node.globalProxy = new Proxy({} as any, {
      has: () => true,
      get: (o, k) => (k in o ? o[k] : globalThis[k]),
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    });

    Node.getInternalBinding = createInternalBindings(kernel);

    // globals that remain same for all requires
    Object.assign(Node.globalProxy, {
      process: process,
      require: Node.require,
      console,
      global: Node.globalProxy,
      primordials: Node.primordials,
      getInternalBinding: createInternalBindings,
    });

    Node.moduleCache = new Map<string, any>();

    Node.moduleCache.set('@node/buffer.js', buffer);
    Node.moduleCache.set('@node/internal/console/global.js', console);
    Node.moduleCache.set('@node/v8.js', {});

    Node.require('internal/per_context/primordials');
    console.log(Node.primordials);

    let loadersExport = Node.require('internal/bootstrap/loaders');
    Object.assign(Node.globalProxy, {
      internalBinding: loadersExport.internalBinding,
    });

    // left see if we can avoid this for now, and just require core node modules as required and run that code
    // Node.require('internal/bootstrap/node');

    // load filesystem for others to use
    Node.fs = Node.require('fs');
  }
  static require(fileName: string) {
    const __filename = Node.resolve(fileName);
    // console.log(__filename);

    if (Node.moduleCache.has(__filename || fileName))
      return Node.moduleCache.get(__filename || fileName);

    if (!__filename) throw new Error(`File not found ${JSON.stringify(fileName)}`);

    let contents = Node.kernel.fs.readFileSync('/' + __filename, 'utf8', FileFlag.getFileFlag('r'));

    let result = Node.eval(contents);
    console.log(__filename, result);

    Node.moduleCache.set(__filename, result);
    return result;
  }
  static resolve(fileName: string) {
    return `@node/${fileName}.js`;
  }

  static eval(source: string) {
    const module = { exports: {} };
    const exports = module.exports;

    Object.assign(Node.globalProxy, {
      module,
      exports,
      __filename: '',
      __dirname: '',
      window: undefined,
      globalThis: Node.globalProxy,
      importScripts: undefined,
    });

    const moduleProxy = new Proxy(
      { module },
      {
        has: () => true,
        get: (o, k) => (k in o ? o[k] : Node.globalProxy[k]),
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

    try {
      let result = evalWithContext(moduleProxy);

      if (result != undefined) {
        return result;
      }
    } catch (e) {
      console.log(e);
      throw e;
    }

    return module.exports;
  }
}

Global.Node = Node;
