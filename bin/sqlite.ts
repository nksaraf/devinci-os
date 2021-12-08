#! /bin/deno run
import { sqlite } from '../src/lib/sqlite/sqlite.ts';
import { print } from './utils.ts';
import { repl } from './repl';

export async function prompt(data: string) {
  await print(data);
}

export async function main() {
  let sql = String.raw;
  //     db.exec(sql`CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)`);
  console.log(sqlite);
  let db = await sqlite.open();
  console.log(db);

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
