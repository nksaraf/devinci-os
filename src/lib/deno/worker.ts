import { wrap } from '$lib/comlink/mod';
import type { Remote } from '$lib/comlink/mod';
import type { DenoIsolate } from '../denix/isolate';
import { newPromise } from '$lib/promise';
import type { DenixProcess } from '../denix/denix';

export class DenixWorker {
  isolate: Remote<DenoIsolate>;
  get Deno(): typeof Deno {
    return this.isolate.Deno as unknown as typeof Deno;
  }
  constructor(public kernel) {
    this.isolate = wrap(
      new Worker('/src/lib/deno/deno.worker.ts?worker-file', {
        type: 'module',
      }),
    );

    // resolved later when ready() is called by user, should probably make the whole thing one async function
    this.connect(kernel);
  }

  readyPromise = newPromise();
  async ready() {
    await this.readyPromise.promise;
  }

  async connect(kernel: DenixProcess) {
    let port = await kernel.fsRemote.proxy.newConnection();
    await this.isolate.connectRemote(port);
    this.readyPromise.resolve(true);
  }
}
