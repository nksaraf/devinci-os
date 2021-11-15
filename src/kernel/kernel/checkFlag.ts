import type { KernelFlags } from './types';

export function checkFlag(f: number, flags: KernelFlags): boolean {
  return (f & flags) > 0;
}
