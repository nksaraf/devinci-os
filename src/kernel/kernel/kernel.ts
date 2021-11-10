import '../node/polyfill';
import type { FileSystem } from '../fs/create-fs';
import type { ProcessManager } from './proc';
import type { Network } from './net';
import mitt from 'mitt';
import { KernelFlags } from './types';
import type { Process } from './proc';

// Can be run in a few modes:
// The kernel is available in all contexts, just in different ways
//
// The kernel should be run on
export class Kernel {
  fs: FileSystem;
  proc: ProcessManager;
  net: Network;
  events: ReturnType<typeof mitt>;
  sw: ServiceWorker;

  // current process if a process has begun, all work must be happening within
  // a process, during boot, a process is initialized
  process: Process;

  async boot(mode: KernelFlags) {
    this.events = mitt();
    this.events.on('*', console.log);
    this.events.emit('kernel:boot:start');

    // lazy loading whatever we can
    const { ProcessManager } = await import('./proc');
    this.proc = new ProcessManager(this);
    this.events.emit('kernel:pm:loaded', this.proc);

    const { FileSystem } = await import('../fs/create-fs');

    FileSystem.Create({}, (err, fs) => {
      if (err) {
        throw err;
      }
      this.fs = fs;
      this.events.emit('kernel:fs:loaded', this.fs);
    });

    if (!((mode & KernelFlags.DISABLE_NET) === KernelFlags.DISABLE_NET)) {
      const { Network } = await import('./net');
      this.net = new Network();
      this.events.emit('kernel:net:loaded', this.net);
    }

    if ((mode & KernelFlags.BOOTLOADER) === KernelFlags.BOOTLOADER) {
      this.events.emit('kernel:proc:init');
      let initPid = this.proc.init();
      this.process = this.proc.getProcess(initPid);
      this.events.emit('kernel:proc:pid', { initPid, process: this.process });
    }

    this.events.emit('kernel:boot:success');

    const chanel = new BroadcastChannel('kernel');
    console.log(chanel);
    chanel.addEventListener('message', (e) => {
      console.log(e);
    });

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue('hello');
        controller.enqueue('world');
        controller.close();
      },
    });

    readable
      .getReader()
      .read()
      .then((result) => {
        console.log('stream', result);
      });
    // const allChunks = [];
    // for await (const chunk of readable) {
    //   allChunks.push(chunk);
    // }
    // console.log(allChunks.join(' '));

    setTimeout(() => {
      chanel.postMessage('kernel:ready');
    }, 1000);

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
