import '$lib/service-worker';
import { fs } from '$lib/fs';
import { DenoIsolate } from '../denix/isolate';
import { Global } from '$lib/global';
import { RemoteFileSystem } from '$lib/fs/remote';
import { DenixProcess } from '$lib/denix/denix';

export const fsWorker = new Worker('/src/lib/deno/fs.worker.ts?worker_file', {
  type: 'module',
});

export let fsRemote = new RemoteFileSystem(fsWorker, false);

fs.rootFs = fsRemote;

await fsRemote.proxy.ready();

export const main = new DenixProcess();
await main.init();
main.fs = fs;
main.fsRemote = fsRemote;

export let isolate = new DenoIsolate();
await isolate.attach(main);

export const Deno = isolate.context.Deno;
Global.Deno = isolate.context.Deno;

export { fs };
