import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread.ts';
import { wrap } from '../comlink/comlink.ts';

export let sqliteWorker = new Worker(
  new URL('./sqlite.worker.ts?worker-file', import.meta.url).href,
  {
    type: 'module',
    name: 'sqlite.worker',
  },
);

initBackend(sqliteWorker);

export let sqlite = wrap<{ init: () => Promise<void>; open: () => Promise<void> }>(sqliteWorker);
