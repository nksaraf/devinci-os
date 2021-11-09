import KernelWorker from './kernel/kernel?worker';
import * as Comlink from 'comlink';
import type { Kernel as KernelType } from './kernel/kernel';

export type Kernel = KernelType;
export let worker = new KernelWorker();
export const Kernel = Comlink.wrap<typeof KernelType>(worker);
