import type { VirtualFileSystem } from '../../tmp/fs/create-fs.ts';
import * as path from 'path-browserify';
import { wrap } from 'comlink.ts';
import EsbuildWorker from './esbuild-worker?worker.ts';
import { syncDownloadFile } from 'os/tmp/fs/generic/xhr.ts';
import Global from '$lib/global.ts';
import type { Context } from '../../denix/isolatee.ts';
import { getModuleFn } from '../../denix/runtimee.ts';
import { getEvalAsyncFunction } from '../eval.ts';

// Assumes Deno environment
// if we want to intercept the require calls, but we should probably convert to urls
export class Linker {
  private moduleCache: Map<string, any>;
  esbuild = wrap<{
    init: () => void;
    transpileSync: (
      data: SharedArrayBuffer,
      options: { url: string; mode: 'script' | 'module' },
    ) => void;
  }>(new EsbuildWorker());
  fs: VirtualFileSystem;
  constructor() {
    this.require = this.require.bind(this);
    this.resolve = this.resolve.bind(this);
  }

  require(moduleName: string, context: Context) {
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
        if (this.fs.existsSync(a)) {
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
    Global.linker = this;
  }

  fetchModule(fileName: string, context: Context) {
    let data = fileName.startsWith('http')
      ? syncDownloadFile(fileName, 'buffer')
      : Deno.readFileSync(fileName);
    return data;
  }

  async eval(src: string, context: Context) {
    // let code = this.transpileToCJS(new TextEncoder().encode(src), {
    //   url: '/deno/tmp.ts',
    //   mode: 'script',
    // });
    return await getEvalAsyncFunction(src, context)();
  }

  evalScript(fileName: string, context: Context) {
    let data = this.fetchModule(fileName, context);
    let code = this.transpileSync(data, { url: fileName, mode: 'script' });
    let moduleFn = getModuleFn(code, {
      globalContext: context,
      require: this.require.bind(this),
      url: fileName,
      mode: 'script',
    });

    let promiseOrExports = moduleFn();

    this.moduleCache.set(fileName, promiseOrExports);
    return promiseOrExports;
  }

  loadModule(fileName: string, context: Context) {
    let data = this.fetchModule(fileName, context);
    let code = this.transpileSync(data, { url: fileName, mode: 'module' });
    let moduleFn = getModuleFn(code, {
      url: fileName,
      mode: 'module',
      globalContext: context,
      require: this.require.bind(this),
    });

    let promiseOrExports = moduleFn();

    this.moduleCache.set(fileName, promiseOrExports);
    return promiseOrExports;
  }

  private transpileSync(data: Uint8Array, options) {
    const sharedBuffer = new SharedArrayBuffer(data.length * 2 + 1500);

    let markers = new Int32Array(sharedBuffer, 0, 8);
    Atomics.store(markers, 0, 0);
    Atomics.store(markers, 1, data.length);

    new Uint8Array(sharedBuffer).set(data, 8);

    this.esbuild.transpileSync(sharedBuffer, options);

    Atomics.wait(markers, 0, 0);

    let code = new TextDecoder().decode(
      new Uint8Array(
        new Uint8Array(sharedBuffer, 8, Atomics.load(new Int32Array(sharedBuffer, 0, 8), 1)),
      ),
    );
    return code;
  }
}
