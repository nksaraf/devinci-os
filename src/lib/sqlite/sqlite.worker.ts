import initSqlJs from '@jlongster/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';
import { expose, proxy } from '../comlink/mod';

let sql = String.raw;

// async function runQueries() {
//   try {
//     db.exec(sql`CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)`);
//   } catch (e) {}

//   db.exec(sql`BEGIN TRANSACTION`);
//   let stmt = db.prepare(sql`INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)`);
//   for (let i = 0; i < 5; i++) {
//     stmt.run([i, ((Math.random() * 100) | 0).toString()]);
//   }
//   stmt.free();
//   db.exec('COMMIT');

//   stmt = db.prepare(`SELECT * FROM kv`);
//   stmt.step();
//   console.debug('Result:', stmt.getAsObject());
//   stmt.free();
// }
let SQL;
async function init() {
  SQL = await initSqlJs({ locateFile: (file) => file });
  let sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
  SQL.register_for_idb(sqlFS);

  SQL.FS.mkdir('/sql');
  SQL.FS.mount(sqlFS, {}, '/sql');
}

let initPromise = init();

expose({
  open: async (path) => {
    await initPromise;
    let db = new SQL.Database('/sql/db.sqlite', { filename: true });
    db.exec(`
      PRAGMA page_size=8192;
      PRAGMA journal_mode=MEMORY;
    `);
    return proxy({
      exec: (sql) => db.exec(sql),
      prepare: (sql) => proxy(db.prepare(sql)),
    });
  },
});
