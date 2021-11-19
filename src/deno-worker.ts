import { expose } from 'comlink';
import './comlink';
patchLog('deno-worker');
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

      import * as path from "https://deno.land/std@0.115.1/path/mod.ts";
import { readableStreamFromReader } from "https://deno.land/std@0.115.1/streams/mod.ts";

  // Start listening on port 8080 of localhost.
  (async () => {
    const server = Deno.listen({ port: 8080 });
  console.log("File server running on http://localhost:8080/");

  for await (const conn of server) {
    handleHttp(conn);
  }

  async function handleHttp(conn: Deno.Conn) {
    const httpConn = Deno.serveHttp(conn);
    for await (const requestEvent of httpConn) {
      // Use the request pathname as filepath
      const url = new URL(requestEvent.request.url);
      const filepath = decodeURIComponent(url.pathname);

      // Try opening the file
      let file;
      try {
        file = await Deno.open("." + filepath, { read: true });
        const stat = await file.stat();

        // If File instance is a directory, lookup for an index.html
        if (stat.isDirectory) {
          file.close();
          const filePath = path.join("./", filepath, "index.html");
          file = await Deno.open(filePath, { read: true });
        }
      } catch {
        // If the file cannot be opened, return a "404 Not Found" response
        const notFoundResponse = new Response("404 Not Found", { status: 404 });
        await requestEvent.respondWith(notFoundResponse);
        return;
      }

      // Build a readable stream so the file doesn't have to be fully loaded into
      // memory while we send it
      const readableStream = readableStreamFromReader(file);

      // Build and send the response
      const response = new Response(readableStream);
      await requestEvent.respondWith(response);
    }
  }
})()
    `),
  );

  console.log(await linker.loadModule('/test.ts', deno.context));
})();

expose({
  initialize: {},
});

function patchLog(str) {
  // let log = console.log;
  // let time = console.log;
  // let timeEnd = console.log;
  // console.log = function () {
  //   log(str, ...arguments);
  // };
  // console.time = function () {
  //   time(str + ' ' + arguments[0]);
  // };
  // console.timeEnd = function () {
  //   timeEnd(str + ' ' + arguments[0]);
  // };
}
