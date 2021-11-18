import { expose } from 'comlink';
import { DenoRuntime } from './deno/deno';
import { createKernel } from './kernel/kernel';
import { KernelFlags } from './kernel/kernel/types';
import './comlink';

declare global {
  interface Window {
    parent: Window;
    postMessage: (message: any, targetOrigin?: string) => void;
  }
}

await createKernel({
  mode: KernelFlags.PRIVILEGED | KernelFlags.UI | KernelFlags.MAIN,
});

DenoRuntime.bootstrapWithRemote(self)
  .then(async (deno) => {
    await deno.eval(`
  const text = await Deno.readTextFile("/hello.txt");
  console.log(text);`);
  })
  .catch(console.error);

expose({
  initialize: {},
});
