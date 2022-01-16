import { run } from './run.js.ts';
import { readCommand } from './tty.js.ts';

export const runShell = async () => {
  // Catch SIGINT.
  Deno.addSignalListener('SIGINT', (_) => {
    Deno.exit();
  });

  while (true) {
    const userInput = await readCommand();

    try {
      await run(userInput, true);
    } catch (err) {
      console.error(err);
    }
  }
};
