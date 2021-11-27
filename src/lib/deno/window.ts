import 'os/lib/service-worker';
import { fs } from 'os/lib/fs';
import { DenoIsolate } from '../denix/isolate';
import { Global } from 'os/lib/global';
import { RemoteFileSystem } from 'os/lib/fs/remote';
import { Kernel } from 'os/lib/denix/denix';

export const fsWorker = new Worker('/src/lib/deno/fs.worker.ts?worker_file', {
  type: 'module',
});

export let fsRemote = new RemoteFileSystem(fsWorker, false);

fs.rootFs = fsRemote;

await fsRemote.proxy.ready();

export const Denix = new Kernel();
await Denix.init();
Denix.fs = fs;
Denix.fsRemote = fsRemote;

export let isolate = new DenoIsolate();
await isolate.attach(Denix);

export const Deno = isolate.context.Deno;
Global.Deno = isolate.context.Deno;

export { fs };
