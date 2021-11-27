import SQLiteWorker from './sqlite.worker?worker';
import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';

// function init() {
//   let worker = new SQLiteWorker();
//   // This is only required because Safari doesn't support nested
//   // workers. This installs a handler that will proxy creating web
//   // workers through the main thread
//   initBackend(worker);
// }

// init();
