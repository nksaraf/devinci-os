import { parse } from 'https://deno.land/std@0.116.0/flags/mod.ts';
import { red } from 'https://deno.land/std@0.116.0/fmt/colors.ts';
import { println, print, decoder } from './utils.ts';

async function prompt(data) {
  navigator.process.tty._promptPrefix = data;
  await print(data);
}

async function runCommand(argv: string[]) {
  const { _ } = parse(argv);
  let cmd = _[0];

  let { main } = await import(`/bin/${cmd}.ts`);

  if (!main) {
    println(`/bin/${cmd}.ts does not export a main function`);
    return -1;
  }

  return await main(argv);

  // await println('command not found: ' + cmd);
}

export async function main() {
  while (true) {
    await prompt(red('> '));

    let data = new Uint8Array(100);

    const n = await Deno.stdin.read(data);
    if (n && n > 0) {
      let args = decoder.decode(data.subarray(0, n)).split(' ');
      try {
        let returnCode = (await runCommand(args)) ?? 0;
        if (returnCode < 0) {
          await println('command exited with error');
        }
      } catch (e) {
        await println(e.stack);
      }
    }
  }
}

main();
