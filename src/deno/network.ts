import { Network } from './denix/network';
import { rest, setupWorker } from 'msw';
import TranspileWorker from './transpiler?worker';
import { wrap } from './comlink';

import { fs } from './fs';
import { newPromise } from './util';
import { ApiError, ERROR_KIND_TO_CODE } from 'os/kernel/fs/core/api_error';
import { fromWireValue, toWireValue } from './transferHandlers';

async function createLocalNetwork() {
  Network.worker = setupWorker(
    rest.get('https://deno.land/std*', async (req, res, ctx) => {
      const orig = await ctx.fetch(req);
      let data = await transpiler.transpile(orig.body);
      return res(ctx.body(data), ctx.set('Content-Type', 'application/javascript'));
    }),
    rest.get('file://*', async (req, res, ctx) => {
      // const orig = await ctx.fetch(req);
      console.log(req);
      return res(ctx.body('data'));
    }),
    rest.post('/~fs*', async (req, res, ctx) => {
      // const orig = await ctx.fetch(req);
      let [fnName, args] = JSON.parse(req.body as string) as [string, any[]];

      let argList = args.map((a) => fromWireValue(a[0]));
      console.log(fnName, argList);

      if (fnName.endsWith('Sync')) {
        const prom = newPromise();

        argList.push((e, ...rv) => {
          console.log(e, ...rv);
          if (e) {
            if (e instanceof ApiError) {
              console.log(e.code);
              let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
              console.log('error code', getCode);
              prom.resolve(
                res(
                  ctx.json([
                    {
                      $err_class_name: getCode[0],
                      code: getCode[1],
                      stack: e.stack,
                    },
                  ]),
                ),
              );
            }
            prom.reject(e);
          } else {
            console.log(rv);
            prom.resolve(res(ctx.json([null, ...rv?.map(toWireValue)] ?? [null])));
          }
        });

        fs[fnName.substr(0, fnName.length - 4)](...argList);

        return await prom.promise;
      }
      return res(ctx.body('{}'));
    }),
  );

  await Network.worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: '/deno-sw.js',
    },
  });

  const transpiler = wrap<{ transpile(data: ArrayBuffer | ReadableStream): string }>(
    new TranspileWorker(),
  );
}

await createLocalNetwork();

export { Network };
