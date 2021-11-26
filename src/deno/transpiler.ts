import { expose } from './comlink';
import * as suc from 'sucrase';

expose({
  transpile: async function (code, options) {
    if (code instanceof Uint8Array) {
      console.log(code);
      return suc.transform(new TextDecoder().decode(code), {
        transforms: ['typescript'],
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

      return suc.transform(response, {
        transforms: ['typescript'],
        disableESTransforms: true,
      }).code;
    }
  },
});
