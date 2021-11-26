import { Kernel } from './denix/denix';
import { fs } from './fs';

export async function initKernel() {
  console.log('booting Kernel');
  const denix = await Kernel.create();
  denix.fs = fs;
  return denix;
}

export const kernel = await initKernel();
