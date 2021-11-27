import { kernel } from './init';
import { DenoIsolate } from './deno';
import { expose, wrap } from './comlink';
import { Global } from 'os/kernel/global';
import { remoteFS } from './fs/fs';

export let deno = new DenoIsolate();

export let Deno;

deno.acceptConnection = async (port, options) => {
  await kernel.init();
  remoteFS.proxy = wrap(port);
  await deno.attach(kernel);
  Deno = deno.context.Deno;
  Global.Deno = deno.context.Deno;
  Global.deno = deno;

  Global.Response = deno.context.Response;
  Global.Request = deno.context.Request;
};

expose(deno);
