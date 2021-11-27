import { Kernel } from './denix/denix';
import { fs } from './fs/fs';

export async function initKernel() {
  console.log('booting Kernel');
  const denix = new Kernel();
  denix.fs = fs;
  return denix;
}

export const kernel = await initKernel();
