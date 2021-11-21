import { expose, wrap } from 'comlink';
import '../comlink';
declare global {
  interface Window {
    parent: Window;
    postMessage: (message: any, targetOrigin?: string) => void;
  }
}

import '../comlink';
import { Channel } from '../comlink';
import { Kernel } from './denix';
import { DenoIsolate, Linker } from './deno';
import { Global } from '../kernel/global';

//   for (var entry of Deno.readDirSync('/')) {
//     console.log(entry);
//   }
//   console.log(await (await deno.context.fetch('http://localhost:4507')).text());
// })();

export class DenoWorker {
  deno: DenoIsolate;
  kernel: Kernel;
  async init() {
    this.kernel = await Kernel.create();
    Global.fs = this.kernel.fs;

    this.deno = new DenoIsolate();
    await this.deno.create();
    await this.deno.attach(this.kernel);
  }

  async run(script) {
    console.log('running', script);
    console.log(await this.deno.run(script));
  }

  async eval(src) {
    console.log('evaling', src);
    console.log(await this.deno.eval(src));
  }

  addEventListener(event, listener) {
    this.deno.addEventListener(event, listener);
  }

  async connect() {}
}

let worker = new DenoWorker();

expose(worker);
// expose({
// connect: () => {
//   const remoteExpose = new MessageChannel();
//   const localExpose = new MessageChannel();

//   wrap(remoteExpose.port1);
//   expose({}, localExpose.port1);
//   let channel = new Channel();
//   channel.portToExpose = remoteExpose.port2;
//   channel.portToWrap = localExpose.port2;
//   return channel;
// },
// });
