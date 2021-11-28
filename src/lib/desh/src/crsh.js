import { startup } from "../startup.js";
import { run } from "./run.js";
import { readCommand } from "./tty.js";

await startup();

const runMain = async () => {
  // Catch SIGINT.
  Deno.addSignalListener("SIGINT", (_) => {
    console.log("interrupted!");
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

await runMain();
