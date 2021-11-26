import type { SetupWorkerApi } from 'msw';
// import { setupWorker } from 'msw';

declare global {
  interface Navigator {
    serviceWorker: ServiceWorkerContainer;
  }
}

export class Network {
  static worker: SetupWorkerApi;

  static async ensureConnected() {
    if (!Network.worker) {
      // await Network.connect();
    }
  }
}
