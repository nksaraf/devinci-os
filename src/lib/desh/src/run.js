import { StringReader } from 'https://deno.land/std@0.115.0/io/readers.ts';
import { StringWriter } from 'https://deno.land/std@0.115.0/io/writers.ts';

import { builtins, defaultExtraUnixArgs } from './builtins.js';
import {
  mergeArgsBetweenQuotes,
  replaceEnvVars,
  evalAndInterpolateJS,
  expandCommand,
} from './util.js';

export const run = (userInput, isTTY) => {
  return new Promise(async (resolve, reject) => {
    let completedProcesses = 0;
    let finalResult;

    if (userInput.length === 0) {
      resolve();
      return;
    }

    ///////
    // Simple JS REPL execution
    // TODO: This is kinda broken feeling.
    ///////
    if (userInput.endsWith(';')) {
      try {
        const result = Function(`return ${userInput}`)();
        console.log(result);
        resolve(result);
      } catch (err) {
        console.error(err.toString());
        reject(err);
      }
      return;
    }

    ///////
    // Parse input and set up any output file
    // TODO Parse more than just "|" (there are other separators! Error pipes, file pipes, etc)
    ///////
    const [rawCommands, outputFilename] = userInput
      .trim()
      .split(' >')
      .map((untrimmed) => untrimmed.trim());

    const commands = rawCommands.split('|');

    const outputFile = outputFilename
      ? await Deno.open(outputFilename, { write: true, create: true })
      : null;

    const incrementAndCheckCompletion = async () => {
      completedProcesses += 1;
      if (completedProcesses >= commands.length) {
        resolve(finalResult?.trim());
        return;
      }
    };

    let lastIO = {
      stdin: new StringWriter(),
      stdout: new StringReader(''),
      stderr: new StringReader(''),
    };

    lastIO.stdout.close = () => {};
    lastIO.stderr.close = () => {};

    ///////
    // Command execution
    ///////
    for (let index = 0; index < commands.length; index++) {
      const isFirst = index === 0;
      const isLast = index === commands.length - 1;
      const command = commands[index];
      const trimmed = command.trim();
      const withEnvVarsReplaced = replaceEnvVars(trimmed);

      ///////
      // Anonymous functions
      ///////
      if (/^\(.*\) ?=> ?(.|\n)*$/.test(withEnvVarsReplaced)) {
        const lastOutput = new TextDecoder().decode(await Deno.readAll(lastIO.stdout));
        await lastIO.stdout?.close();
        await lastIO.stderr?.close();

        let json = undefined;
        try {
          // TODO Try to parse as e.g. multiple json blobs.
          json = JSON.parse(lastOutput.trim());
        } catch (err) {
        } finally {
        }

        const unslicedLines = lastOutput.split('\n');
        const lines = unslicedLines.slice(0, unslicedLines.length - 1);

        // TODO Consider supporting custom transformers here
        // e.g. make it easy to search if the result looked like a DOM node.
        // Alternatively, think of some solution for specifying transformers so I don't
        // have to test the data. I could do this by simply parsing the arguments list

        // TODO Capture console logs and other stdout/err writes here.
        // This can be done by somehow setting the stdout for this execution.
        // How can I do that?
        try {
          const func = eval(`async ${withEnvVarsReplaced}`);
          const result = await func({
            raw: lastOutput,
            lines,
            json,
          });

          let nextContent;
          if (result instanceof Array) {
            nextContent = result.join('\n');
          } else if (result instanceof Object) {
            nextContent = JSON.stringify(result, null, 4);
          } else {
            nextContent = result ? result.toString() : '';
          }

          lastIO = {
            stdout: new StringReader(`${nextContent}\n`),
            stderr: new StringReader(''),
            stdin: new StringWriter(),
          };
          lastIO.stdout.close = () => {};
          lastIO.stderr.close = () => {};

          if (isLast) {
            finalResult = nextContent;
          }

          if (isLast && outputFile === null) {
            await Deno.stdout.write(new TextEncoder().encode(`${nextContent}\n`));
          } else if (isLast && outputFile !== null) {
            await outputFile.write(new TextEncoder().encode(`${nextContent}\n`));
            await outputFile.close();
          }
        } catch (err) {
          console.error(`Failed to execute command: ${err.toString()}`);
        }

        await incrementAndCheckCompletion();
        continue;
      }

      const expanded = await expandCommand(withEnvVarsReplaced);

      console.log(expanded);
      let withInterpolatedJS;
      try {
        withInterpolatedJS = evalAndInterpolateJS(expanded);
      } catch (err) {
        console.error('Failed to interpolate JS: ', err.toString());
        await incrementAndCheckCompletion();
        continue;
      }
      const splitCommand = withInterpolatedJS.split(' ');
      const executable = splitCommand[0].trim();
      let args = mergeArgsBetweenQuotes(splitCommand.slice(1));

      if (builtins[executable] !== undefined) {
        try {
          const lastOutput = new TextDecoder().decode(await Deno.readAll(lastIO.stdout));
          await lastIO.stdout?.close();
          await lastIO.stderr?.close();

          const result = await builtins[executable](args, lastOutput);
          const nextContent = result ? result.toString() : '';
          lastIO = {
            stdout: new StringReader(`${nextContent}`),
            stderr: new StringReader(''),
            stdin: new StringWriter(),
          };
          lastIO.stdout.close = () => {};
          lastIO.stderr.close = () => {};

          if (isLast) {
            finalResult = nextContent;
          }

          if (isLast && outputFile === null) {
            await Deno.stdout.write(new TextEncoder().encode(`${nextContent}`));
          } else if (isLast && outputFile !== null) {
            await outputFile.write(new TextEncoder().encode(`${nextContent}\n`));
            await outputFile.close();
          }
        } catch (err) {
          console.error(`Failed to execute command ${executable}: ${err.toString()}`);
        } finally {
          await incrementAndCheckCompletion();
          continue;
        }
      }

      ///////
      // Unix process
      ///////
      try {
        if (defaultExtraUnixArgs[executable] !== undefined) {
          args = defaultExtraUnixArgs[executable](args);
        }

        const shouldInheritStdout = isLast && outputFile === null && isTTY;
        const shouldInheritStdErr = isLast && isTTY;

        // TODO Support stderr pipes, and also file output
        const p = Deno.run({
          cmd: [executable, ...args],
          stdin: isFirst ? 'inherit' : 'piped',
          stdout: shouldInheritStdout ? 'inherit' : 'piped',
          stderr: shouldInheritStdErr ? 'inherit' : 'piped',
        });

        if (!isFirst) {
          const prevOutput = lastIO.stdout;
          const currentInput = p.stdin;

          await Deno.copy(prevOutput, currentInput);
          await p.stdin.close();

          await lastIO.stdout?.close();
          await lastIO.stderr?.close();
        }

        if (isLast && outputFile !== null) {
          await Deno.copy(p.stdout, outputFile);
          await outputFile.close();
        }

        if (isLast && !isTTY) {
          finalResult = new TextDecoder().decode(await Deno.readAll(p.stdout));
          await p.stdout?.close();
          await p.stderr?.close();
        }

        lastIO = {
          stdout: p.stdout,
          stdin: p.stdin,
          stderr: p.stderr,
        };

        p.status().then(async (computedStatus) => {
          await p.close();
          await incrementAndCheckCompletion();
        });
      } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
          console.error(`Couldn't find command "${executable}"`);
          await incrementAndCheckCompletion();
          continue;
        } else {
          console.error(`Failed to execute command: ${err.toString()}`);
          await incrementAndCheckCompletion();
          continue;
        }
      }
    }
  });
};
