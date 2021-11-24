/// <reference path="../dom.d.ts" />

import { proxy, wrap } from '../comlink';
import type { Remote } from '../comlink';

declare global {
  interface Navigator {
    serviceWorker: ServiceWorkerContainer;
  }
}

interface IServiceWorker {
  add(method: string, path: string, fn: (req: Request) => Promise<Response>): void;
  hello(): string;
}

export class Network {
  static worker: Remote<IServiceWorker>;

  static async add(method: string, path: string, fn: IServiceWorker['add']) {
    await Network.ensureConnected();
    await Network.worker.add(method, path, proxy(fn) as any);
  }

  static async ensureConnected() {
    if (!Network.worker) {
      await Network.connect();
    }
  }

  static async connect() {
    if ('serviceWorker' in navigator) {
      let url = new URL(import.meta.url);
      url.pathname = '/deno-sw.ts';
      url.searchParams.delete('t');
      url.searchParams.append('worker_file', 'true');
      let reg = await window.navigator.serviceWorker.register(url.toString(), {
        scope: '/',
        type: 'module',
      });

      const channel = new MessageChannel();
      Network.worker = wrap(channel.port1);

      reg.active.postMessage(
        {
          type: 'CONNECT',
          data: {
            port: channel.port2,
          },
        },
        [channel.port2],
      );
    }
  }
}
