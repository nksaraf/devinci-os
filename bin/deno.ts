import '../src/lib/deno/deno.ts';
import { parse } from 'https://deno.land/std@0.116.0/flags/mod.ts';

export async function main(args: string[]) {
  const parsedArgs = parse(args);

  if (parsedArgs._[1] === 'run') {
    // @ts-ignore
    await navigator.isolate.run(parsedArgs._[2]);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
