import { FileFlag } from '../fs/core/file_flag';

import Global from '../global';

import { createInternalBindings } from './internal_binding';
import type { Kernel } from '../kernel';

// polyfilling buffer
import * as buffer from 'buffer';

export class NodeHost {
  static kernel: typeof Kernel;
  static fs: typeof import('fs');
  private static moduleCache: Map<string, any>;
  private static globalProxy: typeof globalThis;
  private static primordials: any = {};
  private static getInternalBinding;
  static internalUrl = '/@node';
  static bootstrap(kernel: typeof Kernel) {
    NodeHost.kernel = kernel;
    NodeHost.globalProxy = new Proxy({} as any, {
      has: () => true,
      get: (o, k) => (k in o ? o[k] : globalThis[k]),
      set: (o, k, v) => {
        o[k] = v;
        return true;
      },
    });

    NodeHost.getInternalBinding = createInternalBindings(kernel);

    // globals that remain same for all requires
    Object.assign(NodeHost.globalProxy, {
      process: process,
      require: NodeHost.require,
      console,
      global: NodeHost.globalProxy,
      primordials: NodeHost.primordials,
      getInternalBinding: NodeHost.getInternalBinding,
    });

    NodeHost.moduleCache = new Map<string, any>();

    // patching some things we dont want to have Node load for us
    NodeHost.moduleCache.set(`${NodeHost.internalUrl}/buffer.js`, buffer);
    NodeHost.moduleCache.set(`${NodeHost.internalUrl}/internal/console/global.js`, console);
    NodeHost.moduleCache.set(`${NodeHost.internalUrl}/v8.js`, {});

    NodeHost.require('internal/per_context/primordials');
    console.log(NodeHost.primordials);

    let loadersExport = NodeHost.require('internal/bootstrap/loaders');
    Object.assign(NodeHost.globalProxy, {
      internalBinding: loadersExport.internalBinding,
    });

    // left see if we can avoid this for now, and just require core node modules as required and run that code
    // Node.require('internal/bootstrap/node');

    // load filesystem for others to use
    NodeHost.fs = NodeHost.require('fs');
  }

  static require(fileName: string) {
    const __filename = NodeHost.resolve(fileName);
    // console.log(__filename);

    if (NodeHost.moduleCache.has(__filename || fileName))
      return NodeHost.moduleCache.get(__filename || fileName);

    if (!__filename) throw new Error(`File not found ${JSON.stringify(fileName)}`);

    let result = NodeHost.loadModule(__filename);
    return result;
  }

  private static loadModule(__filename: string) {
    let contents = NodeHost.kernel.fs.readFileSync(__filename, 'utf8', FileFlag.getFileFlag('r'));

    let result = NodeHost.eval(contents);
    console.log(__filename, result);

    NodeHost.moduleCache.set(__filename, result);
    return result;
  }

  static resolve(fileName: string) {
    return `${NodeHost.internalUrl}/${fileName}.js`;
  }

  static eval(source: string) {
    const module = { exports: {} };
    const exports = module.exports;

    Object.assign(NodeHost.globalProxy, {
      module,
      exports,
      __filename: '',
      __dirname: '',
      window: undefined,
      globalThis: NodeHost.globalProxy,
      importScripts: undefined,
    });

    const moduleProxy = new Proxy(
      { module },
      {
        has: () => true,
        get: (o, k) => (k in o ? o[k] : NodeHost.globalProxy[k]),
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

Global.Node = NodeHost;
