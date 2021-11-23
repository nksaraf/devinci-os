import { wrap } from 'comlink';
import type { Remote } from 'comlink';
import InternalDenoWorker from './deno-worker?worker';
import type { DenoIsolateWorker } from './deno-worker';

export class DenoWorker {
  isolate: Remote<DenoIsolateWorker>;
  constructor() {
    this.isolate = wrap(new InternalDenoWorker());
  }
}
