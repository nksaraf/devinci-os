import { expose } from 'comlink';
import * as esbuild from 'esbuild-wasm';
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';
// import acorn from 'acorn';
// import magicString from 'magic-string';

let log = console.debug;
console.debug = function () {
  log('esbuild', ...arguments);
};

expose({
  transpileSync: async (
    sab: SharedArrayBuffer,
    {
      mode = 'script',
      url = '',
    }: {
      mode: 'script' | 'module';
      url: string;
    },
  ) => {
    console.groupCollapsed('transpiling', url);
    let length = Atomics.load(new Int32Array(sab, 4, 8), 0);
    console.debug('step 1');

    let text = new TextDecoder('utf-8').decode(new Uint8Array(new Uint8Array(sab, 8, length)));
    console.debug('step 2', { text });

    if (text.startsWith('#')) {
      console.debug();
      text = text.substr(text.indexOf('\n') + 1);
    }

    // const acorn = await import('acorn');
    // var jsx = await import('acorn-jsx');
    // const stage3 = await import('acorn-stage3');

    // const magicString = await import('magic-string');

    // console.debug(acorn);

    // text

    // try {
    //   let ast = acorn.parse(text, {
    //     sourceType: 'module',
    //     ecmaVersion: 'latest',
    //     allowAwaitOutsideFunction: true,
    //     allowHashBang: true,
    //     allowReturnOutsideFunction: true,
    //     allowSuperOutsideMethod: true,
    //   });
    //   console.debug(ast);
    // } catch (e) {
    //   console.error(e);
    // }

    try {
      let result = await esbuild.transform(text, {
        format: 'cjs',
        loader: 'ts',
        define: {
          'import.meta.main': mode === 'script' ? 'true' : 'false',
          'import.meta.url': `"${url}"`,
        },
      });

      console.debug('step 3', { result });
      console.groupEnd();

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

  transpile: async (
    text: string,
    {
      mode = 'script',
      url = '',
    }: {
      mode: 'script' | 'module';
      url: string;
    },
  ) => {
    if (text.startsWith('#')) {
      console.debug();
      text = text.substr(text.indexOf('\n') + 1);
    }
    // }

    try {
      let result = await esbuild.transform(text, {
        format: 'cjs',
        loader: 'ts',
        define: {
          'import.meta.main': mode === 'script' ? 'true' : 'false',
          'import.meta.url': `"${url}"`,
        },
      });

      console.debug('step 3', { result });
      console.groupEnd();

      let data = new TextEncoder().encode(result.code);
      return data;
    } catch (e) {
      console.error(e);
      return null;
    }
  },
  async init() {
    console.debug('heree');
    await esbuild.initialize({
      wasmURL: esbuildWasmUrl,
      worker: false,
    });
  },
});
