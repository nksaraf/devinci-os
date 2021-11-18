import { expose } from 'comlink';
import { DenoRuntime } from './deno/deno';
import { DenoHost } from './deno/deno-host';
import { createKernel } from './kernel/kernel';
import { KernelFlags } from './kernel/kernel/types';

declare global {
  interface Window {
    parent: Window;
    postMessage: (message: any, targetOrigin?: string) => void;
  }
}

await createKernel({
  mode: KernelFlags.PRIVILEGED | KernelFlags.UI | KernelFlags.MAIN,
});

const host = new DenoHost();

// DenoRuntime.bootstrapFromHttp(host).then(async (i) => {
//   console.log(await i.eval(`console.log('hello world world')`));
// });

expose(host);
