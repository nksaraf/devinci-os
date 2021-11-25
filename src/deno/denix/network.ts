import type { SetupWorkerApi } from 'msw';
import { setupWorker } from 'msw';

declare global {
  interface Navigator {
    serviceWorker: ServiceWorkerContainer;
  }
}

export class Network {
  static worker: SetupWorkerApi;

  static async ensureConnected() {
    if (!Network.worker) {
      await Network.connect();
    }
  }

  static async connect() {
    Network.worker = setupWorker();

    return await Network.worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/deno-sw.js',
      },
    });
  }
}
