import type { DenoIsolate } from './isolate';

declare global {
  interface Navigator {
    deno: DenoIsolate;
  }
}
if (typeof window !== 'undefined') {
  await import('./bootstrap_main');
} else {
  await import('./bootstrap_worker');
}

export {};
