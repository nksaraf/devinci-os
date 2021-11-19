import { expose } from 'comlink';
import './comlink';

declare global {
  interface Window {
    parent: Window;
    postMessage: (message: any, targetOrigin?: string) => void;
  }
}

// await createKernel({
//   mode: KernelFlags.PRIVILEGED | KernelFlags.UI | KernelFlags.MAIN,
// });

import './comlink';
import { Kernel } from './deno/denix';
import { DenoIsolate, Linker } from './deno/deno';
import { Global } from './kernel/global';

(async () => {
  let kernel = await Kernel.create();
  Global.fs = kernel.fs;
  console.log(Global.fs.existsSync);

  let deno = await DenoIsolate.create(kernel);

  let linker = new Linker();
  console.log(linker);
  await linker.init();

  console.log(deno.context, deno.context.Deno);

  await Deno.writeFile(
    '/test.ts',
    Deno.core.encode(`import {
        ensureDir,
        ensureDirSync,
      } from "https://deno.land/std@0.115.1/fs/mod.ts";

      ensureDir("/bar").then(console.log); // returns a promise
      ensureDirSync("/ensureDirSync"); // void

      function writeJson(path: string, data: object): string {
        try {
          Deno.writeTextFileSync(path, JSON.stringify(data));
      
          return "Written to " + path;
        } catch (e) {
          return e.message;
        }
      }
      
      console.log(writeJson("./data.json", { hello: "World" }));
    `),
  );

  console.log(await linker.loadModule('/test.ts', deno.context));
})();

expose({
  initialize: {},
});
