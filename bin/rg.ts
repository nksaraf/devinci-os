#! /bin/deno run
import { getWAPMUrlForCommandName } from '../src/lib/wapm.ts';
if (import.meta.main) {
  let url = await getWAPMUrlForCommandName('rg');
  await navigator.isolate.run(url);

  Deno.exit(0);
}
