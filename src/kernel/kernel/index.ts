import { wrap } from 'comlink';
import type { Kernel } from './kernel';
import { KernelFlags } from './types';
export type { Kernel };

export async function createKernel<T extends KernelFlags>(env: { mode: T }): Promise<Kernel> {
  if ((env.mode & KernelFlags.WORKER_PROXY) === KernelFlags.WORKER_PROXY) {
    const KernelWorker = (await import('./kernel?worker')).default;
    let worker = new KernelWorker();
    let KernelClass = wrap<typeof Kernel>(worker);
    const kernel = await new KernelClass();
    await kernel.boot(env);
    return kernel as any;
  } else {
    const { Kernel } = await import('./kernel');
    let kernel = new Kernel();
    await kernel.boot(env);
    return kernel;
  }
}
