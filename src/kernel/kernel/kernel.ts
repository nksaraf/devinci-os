import '../node/polyfill';
import type { VirtualFileSystem } from '../fs/create-fs';
import type { ProcessManager } from './proc';
import type { Network } from './net';
import mitt from 'mitt';
import { KernelFlags } from './types';
import type { Process } from './proc';
import Global from '../global';
import { checkFlag } from './checkFlag';

// Can be run in a few modes:
// The kernel is available in all contexts, just in different ways
//
// The kernel should be run on
export class Kernel {
  fs: VirtualFileSystem;
  proc: ProcessManager;
  net: Network;
  events: ReturnType<typeof mitt>;
  sw: ServiceWorker;
  env: { mode: KernelFlags };

  // current process if a process has begun, all work must be happening within
  // a process, during boot, a process is initialized
  process: Process;
  id: number;

  mode: KernelFlags;

  async boot(env: { mode: KernelFlags }) {
    this.env = env;
    this.mode = env.mode;
    this.id = Math.floor(Math.random() * 100000);
    Global.kernel = this;
    const chanel = new BroadcastChannel('kernel');

    this.events = mitt();
    this.events.on('*', console.log);
    this.events.emit('kernel:booting');

    const { VirtualFileSystem } = await import('../fs/create-fs');
    this.fs = new VirtualFileSystem();
    this.events.emit('kernel:vfs:loaded', this.fs);

    // // if started as main
    // if (!(checkFlag(this.mode, KernelFlags.MAIN) || checkFlag(mode, KernelFlags.WORKER))) {
    //   this.events.emit('kernel:main:' + this.id);
    // } else if (checkFlag(mode, KernelFlags.WORKER)) {
    //   this.events.emit('kernel:worker:' + this.id);
    // } else {
    //   try {
    //     await new Promise<void>((resolve, reject) => {
    //       function handleBoot(e) {
    //         if (e.data === 'pong') {
    //           Global.kernel.mode = Global.kernel.mode | KernelFlags.WORKER;
    //           chanel.removeEventListener('message', handleBoot);
    //           resolve();
    //         }
    //       }

    //       chanel.addEventListener('message', handleBoot);

    //       chanel.postMessage({
    //         from: this.id,
    //         message: 'ping',
    //       });

    //       // no other main found in the network, starting as main
    //       setTimeout(() => {
    //         chanel.removeEventListener('message', handleBoot);
    //         Global.kernel.mode = Global.kernel.mode | KernelFlags.MAIN;

    //         resolve();
    //       }, 3000);
    //     });
    //   } catch (e) {}
    // }

    // lazy loading whatever we can
    const { ProcessManager } = await import('./proc');
    this.proc = new ProcessManager(this);
    this.events.emit('kernel:pm:loaded', this.proc);
    this.fs.mount('/proc', this.proc);

    if (checkFlag(this.mode, KernelFlags.MAIN)) {
      this.events.emit('kernel:main:' + this.id);
      // lazy loading whatever we can
    } else if (checkFlag(this.mode, KernelFlags.WORKER)) {
      this.events.emit('kernel:worker:' + this.id);
    }

    // if (!((mode & KernelFlags.DISABLE_NET) === KernelFlags.DISABLE_NET)) {
    const { Network } = await import('./net');
    this.net = new Network();
    this.net.kernel = this;
    this.events.emit('kernel:net:loaded', this.net);
    // }

    // if ((mode & KernelFlags.BOOTLOADER) === KernelFlags.BOOTLOADER) {
    this.events.emit('kernel:proc:init');
    let proc = await this.proc.init();
    this.process = proc;
    this.events.emit('kernel:proc:pid', { id: proc.pid, proc, process: this.process });
    // }

    this.events.emit('kernel:boot:success');

    //     controller.enqueue('hello');
    //     controller.enqueue('world');
    //     controller.close();
    //   },
    // });

    // readable
    //   .getReader()
    //   .read()
    //   .then((result) => {
    //     console.log('stream', result);
    //   });
    // const allChunks = [];
    // for await (const chunk of readable) {
    //   allChunks.push(chunk);
    // }
    // console.log(allChunks.join(' '));

    // setTimeout(() => {
    chanel.postMessage('kernel:ready');
    // }, 1000);

    // Global.kernel = this;
    return this;
  }

  // async initServiceWorker() {
  //   const { setupWorker, rest } = await import('msw');
  //   const worker = setupWorker(
  //     rest.get('/user', (req, res, ctx) => {
  //       return res(
  //         ctx.json({
  //           message: 'Hello, world!',
  //         }),
  //       );
  //     }),
  //   );
  //   // Start the Mock Service Worker
  //   worker.start({
  //     onUnhandledRequest: 'bypass',
  //   });
  // }
}
