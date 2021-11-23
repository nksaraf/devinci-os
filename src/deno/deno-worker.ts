import type { Remote } from 'comlink';
import { Kernel } from './denix';
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

    console.log('heree');

    await super.attach(kernel as Kernel);

    Global.Deno = this.context.Deno;
    this.Deno = this.context.Deno;
  }
}

let worker = new DenoIsolateWorker();

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
