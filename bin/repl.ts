import { red } from 'https://deno.land/std@0.116.0/fmt/colors.ts';
import { println, print, decoder } from './utils.ts';

export async function prompt(data: string) {
  await print(data);
}
export async function repl(onRun: (cmd: string) => Promise<number>) {
  let data = new Uint8Array(1024);

  while (true) {
    await prompt(red('> '));
    const n = await Deno.stdin.read(data);
    if (n && n > 0) {
      let cmd = decoder.decode(data.subarray(0, n));
      if (cmd.trim() === 'exit') {
        return;
      }
      try {
        let returnCode = (await onRun(cmd)) ?? 0;
        if (returnCode < 0) {
          println('command exited with error');
        }
      } catch (e) {
        await println(e.stack);
      }
    }
  }
}
