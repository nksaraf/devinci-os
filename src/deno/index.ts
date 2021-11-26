import { Network } from './network';
import { kernel } from './init';
import { DenoIsolate } from './deno';
import { Global } from 'os/kernel/global';

await kernel.init();

export let deno = new DenoIsolate();
await deno.attach(kernel);

export const Deno = deno.context.Deno;
Global.Deno = deno.context.Deno;
