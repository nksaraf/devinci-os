import { expose } from 'comlink';
import * as esbuild from 'esbuild-wasm';
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';

let log = console.log;
console.log = function () {
  log('esbuild', ...arguments);
};

expose({
  transpile: async (sab: SharedArrayBuffer) => {
    console.log('transpiling', sab);
    let length = Atomics.load(new Int32Array(sab, 4, 8), 0);
    console.log('transpiling', sab);

    let text = new TextDecoder('utf-8').decode(new Uint8Array(new Uint8Array(sab, 8, length)));
    console.log('transpiling', sab);

    try {
      let result = await esbuild.transform(text, {
        format: 'cjs',
        loader: 'ts',
      });
      console.log('transpiling', sab);

      let data = new TextEncoder().encode(result.code);

      let output = new Uint8Array(sab, 8, data.length);
      for (var i = 0; i < data.length; i++) {
        Atomics.store(output, i, data[i]);
      }

      Atomics.store(new Int32Array(sab, 0, 4), 0, 1);
      Atomics.store(new Int32Array(sab, 4, 8), 0, data.length);
      Atomics.notify(new Int32Array(sab, 0, 4), 0, 64000);
    } catch (e) {
      console.error(e);
      Atomics.store(new Int32Array(sab, 0, 4), 0, 1);
      Atomics.store(new Int32Array(sab, 4, 8), 0, 0);
      Atomics.notify(new Int32Array(sab, 0, 4), 0, 64000);
    }
  },
  async init() {
    console.log('heree');
    await esbuild.initialize({
      wasmURL: esbuildWasmUrl,
      worker: false,
    });
  },
});
