import { parse } from 'https://deno.land/std@0.116.0/flags/mod.ts';
import { println } from './utils.ts';

export async function main(args: string[]) {
  let parsed = parse(args);
  for await (let entry of Deno.readDir((parsed._[1] as string) ?? '.')) {
    println(entry.name);
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
