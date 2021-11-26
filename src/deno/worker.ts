import { kernel } from './init';
import { DenoIsolate } from './deno';
import { expose, wrap } from './comlink';
import { Global } from 'os/kernel/global';
import { remoteFS } from './fs';

export let deno = new DenoIsolate();

export let Deno;

deno.acceptConnection = async (port) => {
  remoteFS.proxy = wrap(port);
  await deno.attach(kernel);
  Deno = deno.context.Deno;
  Global.Deno = deno.context.Deno;
  Global.deno = deno;
};

expose(deno);
