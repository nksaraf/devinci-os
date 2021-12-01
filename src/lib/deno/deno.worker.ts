import { DenoIsolate } from '$lib/denix/isolate';
import { expose, wrap } from '$lib/comlink/mod';

import { fs } from '$lib/fs';
import { Global } from '$lib/global';
import { RemoteFileSystem } from '$lib/fs/remote';
import { DenixProcess } from '$lib/denix/denix';

let fsRemote = new RemoteFileSystem(undefined, true);

fs.rootFs = fsRemote;

export const Denix = new DenixProcess();
await Denix.init();
Denix.fs = fs;
Denix.fsRemote = fsRemote;

export let isolate = new DenoIsolate({
  onConnect: async (port) => {
    let fsWorker = port;
    fsRemote.proxy = wrap(fsWorker);
    await fsRemote.proxy.ready();

    await isolate.attach(Denix);

    Global.Deno = isolate.context.Deno;

    // We wanna do this so that that the global fetch calls that are made
    // use the Deno implementations
    // could switch also, that fetch uses the Deno implementation
    Global.Request = isolate.context.Request;
    Global.Response = isolate.context.Response;
  },
});

expose(isolate);
