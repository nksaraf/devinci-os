#! /bin/deno run
import { copy } from 'https://deno.land/std@0.116.0/streams/conversion.ts';
import { parse } from 'https://deno.land/std@0.116.0/flags/mod.ts';

export async function main() {
  let parsed = parse(Deno.args);
  let writeTo = Deno.stdout;
  if (parsed.o) {
    writeTo = await Deno.open(parsed.o, { write: true });
  }
  for (const filename of parsed._.splice(1)) {
    const file = await Deno.open(filename as string);
    await copy(file, writeTo);
    file.close();
  }

  if (parsed.o) {
    writeTo.close();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

if (import.meta.main) {
  sleep(1000).then(console.log);
  main().then(console.log);
}
