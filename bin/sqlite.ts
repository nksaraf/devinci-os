#! /bin/deno run
import { sqlite } from '../src/lib/sqlite/sqlite.ts';
import { repl } from './repl.ts';

export async function main() {
  let sql = String.raw;
  //     db.exec(sql`CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)`);
  console.debug(sqlite);
  let db = await sqlite.open();
  console.debug(db);

  try {
    await db.exec(sql`CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)`);
  } catch (e) {
    console.log(e);
  }

  await repl(async (cmd) => {
    console.log('db.exec', cmd);
    let stmt = await db.prepare(cmd);
    let rows = [];
    while (await stmt.step()) {
      //
      rows.push(await stmt.getAsObject());
    }
    Deno.console.table(rows);
    return 0;
  });
}

if (import.meta.main) {
  await main();
}
