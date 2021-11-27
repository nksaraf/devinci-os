import { expose } from './comlink';
import * as suc from 'sucrase';
import { init, parse } from 'es-module-lexer';

expose({
  transpile: async function (code, options) {
    await init;
    if (code instanceof Uint8Array) {
      console.log(code);
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
      });

      console.log(parse(o.code));

      return o.code;
    }
  },
});
