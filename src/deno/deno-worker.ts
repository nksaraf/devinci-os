import type { Remote } from 'comlink';
import { Kernel } from './denix/denix';
import { DenoIsolate } from './deno';
import { Global } from '../kernel/global';
import { expose } from './comlink';

declare global {
  interface Window {
    parent: Window;
    postMessage: (message: any, targetOrigin?: string) => void;
  }
}

export class DenoIsolateWorker extends DenoIsolate {
  Deno: typeof Deno;

  isAttached: false;

  constructor() {
    super();
  }

  async attach(kernel?: Remote<Kernel> | Kernel | undefined) {
    console.log('heree');
    if (typeof kernel === 'undefined') {
      kernel = await Kernel.create();
      Global.fs = kernel.fs;
    } else {
      Global.fs = await kernel.fs;
    }

    await super.attach(kernel as Kernel);

    Global.Deno = this.context.Deno;
    this.Deno = this.context.Deno;
    Global.deno = this.context;
  }

  async run(url) {
    if (url.endsWith('.wasm')) {
      const { default: Context } = await import(
        'https://deno.land/std@0.115.1/wasi/snapshot_preview1.ts'
      );

      const context = new Context({
        args: ['exa', '-al', 'lib/deno'],
        env: Deno.env.toObject(),
        preopens: {
          '/lib': '/lib',
          '/lib/deno': '/lib/deno',
        },
      });

      const wasm = await WebAssembly.compileStreaming(fetch(url));

      let instance = await WebAssembly.instantiate(wasm, {
        wasi_snapshot_preview1: context.exports,
      });

      await context.start(instance);
      return;
    } else {
      return await super.run(url);
    }
  }
}

let worker = new DenoIsolateWorker();

expose(worker);
