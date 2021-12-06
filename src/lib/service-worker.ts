import { rest, setupWorker } from 'msw';
import type {
  DefaultRequestBody,
  RequestParams,
  ResponseResolver,
  RestContext,
  RestRequest,
} from 'msw';
import TranspileWorker from './transpiler.worker.ts?worker';
import { releaseProxy, wrap } from './comlink/mod';

import { newPromise } from './promise';
import { ApiError, ERROR_KIND_TO_CODE } from './error';
import { fromWireValue, toWireValue } from './comlink/http.handlers';
import { constants } from './constants';
import { processManager } from '$lib/denix/bootup';

export let broadcastChannel: BroadcastChannel = new BroadcastChannel('localhost');

async function createLocalNetwork() {
  let requests = {};
  const handleResponse = (e) => {
    if (e.data.type === 'RESPONSE' && requests[e.data.requestId]) {
      requests[e.data.requestId].resolve(e.data.response);
    }
  };

  broadcastChannel.addEventListener('message', (ev) => {
    handleResponse(ev);
  });

  const transpileHandler: ResponseResolver<
    RestRequest<DefaultRequestBody, RequestParams>,
    RestContext,
    any
  > = async (req, res, ctx) => {
    const orig = await ctx.fetch(req);
    if (orig.status !== 200) {
      return res(ctx.status(orig.status, orig.statusText));
    }

    let contentType = orig.headers.get('content-type');
    let data;
    if (
      !contentType.includes('octet-stream') &&
      !contentType.includes('wasm') &&
      !contentType.includes('html')
    ) {
      data = await transpiler.transpile(orig.body);
      if (req.url.search.includes('script')) {
        if (data.startsWith('#!')) {
          let line = data.indexOf('\n');
          data =
            `import.meta.shebang = '${data.slice(
              2,
              line,
            )}'\nimport 'http://localhost:3000/src/lib/deno/deno.ts'\n` + data.substring(line);
        }

        data = 'import.meta.main = true\n' + data;
      }
      return res(ctx.body(data), ctx.set('Content-Type', 'application/javascript'));
    } else {
      return res(ctx.body(await orig.arrayBuffer()), ctx.set('Content-Type', contentType));
    }
  };

  let worker = setupWorker(
    rest.get('https://deno.land/std*', transpileHandler),
    rest.get('https://deno.land/x/*', transpileHandler),
    rest.get('https://raw.githubusercontent.com/*', transpileHandler),
    rest.get('/bin/*', transpileHandler),
    rest.get('https://gist.githubusercontent.com/*', transpileHandler),
    rest.get('https://crux.land/router*', (req, res, ctx) => {
      req.url = new URL('http://localhost:3000/src/deno/router.ts');
      return transpileHandler(req, res, ctx);
    }),
    rest.get('/_/lib/deno/test_util/std/*', (req, res, ctx) => {
      req.url = new URL(
        'https://deno.land/std@0.116.0/' +
          req.url.pathname.slice('/_/lib/deno/test_util/std/'.length),
      );
      return transpileHandler(req, res, ctx);
    }),
    rest.get('/_/*', async (req, res, ctx) => {
      let file = await Deno.readFile(req.url.pathname.slice(2));
      let data = await transpiler.transpile(new Uint8Array(file));

      if (req.url.search.includes('script')) {
        data =
          'import.meta.main = true\n' +
          (data.startsWith('#!') ? data.substring(data.indexOf('\n')) : data);
      }
      return res(ctx.body(data), ctx.set('Content-Type', 'application/javascript'));
    }),
    rest.post('/~fs*', async (req, res, ctx) => {
      // HANDING SYNCHRONOUS FILE SYSTEM OPERATIONS
      let [fnName, args] = JSON.parse(req.body as string) as [string, any[]];

      let argList = args.map((a) => fromWireValue(a[0]));
      console.debug(fnName, argList);

      if (fnName.endsWith('Sync')) {
        try {
          let result = await processManager.fs[fnName.substring(0, fnName.length - 4)](...argList);
          console.debug(result, toWireValue(result));
          return res(
            ctx.json(
              [null, fnName === 'openSync' ? toWireValue(undefined) : toWireValue(result)] ?? [
                null,
              ],
            ),
          );
        } catch (e) {
          if (e instanceof ApiError) {
            console.debug(e.code);
            let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
            console.debug('error code', getCode);
            return res(
              ctx.json([
                {
                  $err_class_name: getCode[0],
                  code: getCode[1],
                  stack: e.stack,
                  message: e.message,
                },
              ]),
            );
          }
          throw e;
        }
      } else {
        throw new Error('For async operations use the comlink connection');
      }
    }),

    rest.post('/~proc*', async (req, res, ctx) => {
      // HANDING SYNCHRONOUS FILE SYSTEM OPERATIONS
      let [fnName, args] = JSON.parse(req.body as string) as [string, any[]];

      let argList = args.map((a) => fromWireValue(a[0]));
      console.debug(fnName, argList);

      if (fnName.endsWith('Sync')) {
        try {
          let result = await processManager[fnName.substring(0, fnName.length - 4)](...argList);
          console.debug(result, toWireValue(result));
          return res(ctx.json([null, toWireValue(result)] ?? [null]));
        } catch (e) {
          if (e instanceof ApiError) {
            console.debug(e.code);
            let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
            console.debug('error code', getCode);
            return res(
              ctx.json([
                {
                  $err_class_name: getCode[0],
                  code: getCode[1],
                  stack: e.stack,
                  message: e.message,
                },
              ]),
            );
          }
          throw e;
        }
      } else {
        throw new Error('For async operations use the comlink connection');
      }
    }),
    rest.post('/~deno/op/sync/op_exit', async (req, res, ctx) => {
      // HANDING SYNCHRONOUS FILE SYSTEM OPERATIONS
      let [fnName, ...args] = JSON.parse(req.body as string) as [string, any[]];

      let argList = args.map((a) => fromWireValue(a[0]));
      console.debug(fnName, argList);
      let process = processManager.processes.get(argList[0]);

      process.send('EXIT', argList[1]);
      const promise = newPromise();
      let d = process.onUpdate((s) => {
        if (s.isInAny('disposed')) {
          promise.resolve(true);
        }
      });

      await promise.promise;

      d();
      return res();
    }),

    rest.post('/~file*', async (req, res, ctx) => {
      // HANDING SYNCHRONOUS FILE SYSTEM OPERATIONS
      let [path, fnName, args] = JSON.parse(req.body as string) as [string, string, any[]];

      let argList = args.map((a) => fromWireValue(a[0]));
      console.debug(fnName, argList);

      let file = await processManager.fs.open(path, constants.fs.O_RDWR, 0o777);

      console.debug(file);
      if (fnName.endsWith('Sync')) {
        try {
          let result = await file[fnName.substring(0, fnName.length - 4)](...argList);
          console.debug(result, toWireValue(result));
          return res(ctx.json([null, toWireValue(result)] ?? [null]));
        } catch (e) {
          if (e instanceof ApiError) {
            console.debug(e.code);
            let getCode = Object.entries(ERROR_KIND_TO_CODE).find(([k, v]) => v === e.errno);
            console.debug('error code', getCode);
            return res(
              ctx.json([
                {
                  $err_class_name: getCode[0],
                  code: getCode[1],
                  stack: e.stack,
                },
              ]),
            );
          }
          throw e;
        }
      } else {
        throw new Error('For async operations use the comlink connection');
      }
    }),
    rest.get('/~p/:port/*', async (req, res, ctx) => {
      console.debug(req);
      console.debug('/~p/:port/*', req.url.href);
      // somebody made some kind of request to my server

      requests[req.id] = newPromise<{ body: any; status: number; headers: [string, string][] }>();

      setTimeout(() => {
        requests[req.id].resolve({ body: 'timed out in 10 seconds', status: 404, headers: [] });
        delete requests[req.id];
      }, 10000);

      let url = new URL('http://localhost:' + req.params.port + req.url.pathname.slice(8)).href;
      console.debug(url);

      broadcastChannel.postMessage({
        type: 'HTTP_REQUEST',
        url: url,
        port: req.params.port,
        method: req.method,
        headers: [...req.headers.entries()],
        requestId: req.id,
        referrer: req.referrer,
      });

      try {
        let { body, status, headers } = await requests[req.id].promise;
        console.debug('result', { body, status, headers });
        return res(
          ctx.set(Object.fromEntries(headers)),
          ctx.body(body),
          ctx.status(status),
          ctx.set('Cross-Origin-Embedder-Policy', 'require-corp'),
        );
      } catch (e) {
        return res(ctx.text(e.message));
      }
    }),
  );

  await worker.start({
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
