import { run } from './run.js';
import { readCommand } from './tty.js';

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
