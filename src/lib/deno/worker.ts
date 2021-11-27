import { wrap } from 'comlink';
import type { Remote } from 'comlink';
import type { DenoIsolate } from '../denix/isolate';
import { newPromise } from 'os/lib/promise';
import type { Kernel } from '../denix/denix';

export class DenixWorker {
  isolate: Remote<DenoIsolate>;
  get Deno(): typeof Deno {
    return this.isolate.Deno as unknown as typeof Deno;
  }
  constructor(kernel) {
    this.isolate = wrap(
      new Worker('/src/lib/deno/deno.worker.ts?worker-file', {
        type: 'module',
      }),
    );
    this.connect(kernel);
  }

  readyPromise = newPromise();
  async ready() {
    await this.readyPromise.promise;
  }

  async connect(kernel: Kernel) {
    let port = await kernel.fsRemote.proxy.newConnection();
    await this.isolate.connectRemote(port);
    this.readyPromise.resolve(true);
  }
}
