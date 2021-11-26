import { wrap } from 'comlink';
import type { Remote } from 'comlink';
import InternalDenoWorker from './worker?worker';
import type { DenoIsolate } from './deno';
import { remoteFS } from './fs';
import { newPromise } from './util';

export class DenoWorker {
  isolate: Remote<DenoIsolate>;
  get Deno(): typeof Deno {
    return this.isolate.Deno as unknown as typeof Deno;
  }
  constructor() {
    this.isolate = wrap(new InternalDenoWorker());
    this.init();
  }

  readyPromise = newPromise();
  async ready() {
    await this.readyPromise.promise;
  }
  async init() {
    let port = await remoteFS.proxy.newConnection();
    await this.isolate.acceptConnection(port);
    this.readyPromise.resolve(true);
  }
}
