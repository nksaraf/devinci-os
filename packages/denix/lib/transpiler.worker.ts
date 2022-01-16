import { expose } from './comlink/mod.ts';

import * as suc from 'sucrase.ts';
import { init, parse } from 'es-module-lexer.ts';

expose({
  transpile: async function (code, options) {
    await init;
    if (code instanceof Uint8Array) {
      console.debug(code);
      return suc.transform(new TextDecoder().decode(code), {
        transforms: ['typescript', 'jsx'],
        disableESTransforms: true,
      }).code;
    } else {
      let response = '';
      await (code as ReadableStream).pipeTo(
        new WritableStream({
          write: async function (chunk) {
            response += new TextDecoder().decode(chunk);
          },
        }),
      );

      let o = suc.transform(response, {
        transforms: ['typescript', 'jsx'],
        disableESTransforms: true,
        jsxPragma: 'h',
      });

      console.debug(parse(o.code));

      return o.code;
    }
  },
});
