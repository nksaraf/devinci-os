import { DenoIsolate } from 'os/lib/denix/isolate';
import { expose, wrap } from 'os/lib/comlink';
import { fs, configure } from 'os/lib/fs';
import { Global } from 'os/lib/global';
import { RemoteFileSystem } from 'os/lib/fs/remote';
import { Kernel } from 'os/lib/denix/denix';

let fsRemote = new RemoteFileSystem(undefined, true);

fs.rootFs = fsRemote;

export const Denix = new Kernel();
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
