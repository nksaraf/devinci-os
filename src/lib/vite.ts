import { expose } from './comlink/mod';
import { Process } from './denix/kernel';
import { mountDenoLib } from './deno/runtime';
import Global from './global';
// import * as vite from 'browser-vite/dist/browser';

// console.log(vite);

expose({
  run: async () => {
    const process = new Process();
    await process.init({
      pid: 0,
    });

    Reflect.defineProperty(navigator, 'process', {
      value: process,
    });

    await mountDenoLib(process.fs);
    await import('./deno/deno');

    // @ts-expect-error
    const fs = await import('https://deno.land/std@0.116.0/node/fs.ts');

    // @ts-expect-error
    const crypto = await import('https://deno.land/std@0.116.0/node/crypto.ts');

    // @ts-expect-error
    const mod = await import('https://deno.land/std@0.116.0/node/module.ts');

    let req = mod.createRequire('/');
    Global.require = (mod) => {
      if (mod.startsWith('https://deno.land/std@0.116.0/node/fs.ts')) {
        return fs;
      }
      if (mod.startsWith('https://deno.land/std@0.116.0/node/crypto.ts')) {
        return crypto;
      }
      if (mod.startsWith('https://deno.land/std@0.116.0/node/module.ts')) {
        return mod;
      }
      return req(mod);
    };

    const vite = await import('browser-vite/dist/browser');
    let r = await vite.transformRequest('http://localhost:5000/index.html', {});
  },
});
