/// <reference path="./webworker.d.ts" />

import { expose } from 'comlink';
import { transferHandlers } from '../comlink';
import Router from 'trouter';
// export empty type because of tsc --isolatedModules flag
export type {};
declare const self: ServiceWorkerGlobalScope;

/* eslint-disable */
/* tslint:disable */

/**
 * Mock Service Worker (0.35.0).
 * @see https://github.com/mswjs/msw
 * - Please do NOT modify this file.
 * - Please do NOT serve this file on production.
 */

//  const INTEGRITY_CHECKSUM = 'f0a916b13c8acc2b526a03a6d26df85f';
const bypassHeaderName = 'x-msw-bypass';
const activeClientIds = new Set();

self.addEventListener('install', function () {
  return self.skipWaiting();
});

self.addEventListener('activate', async function (event) {
  return self.clients.claim();
});
const router = new Router();

router.add('GET', '/src/*', async (req) => {
  console.log('vite server', req.url);
  return await fetch(req);
});
self.addEventListener('message', async function (event) {
  if (event.data.type === 'CONNECT') {
    // activeClientIds.set(event.source.id, event.data.data.port);
    expose(
      Object.assign({
        add: (method, path, fn, p = 1) => {
          fn.priority = p;
          let route = router.routes.find((r) => r.path === path);

          if (route) {
            route.handler = async (arg) => {
              let res = await fn(arg);
              console.log('got response', res);
              return res;
            };
          } else {
            router.add(method, path, async (arg) => {
              let res = await fn(arg);
              console.log('got response', res);
              return res;
            });
            router.routes[router.routes.length - 1].path = path;
          }
        },
        hello: () => {
          console.log('hello');
          return 'world';
        },
      }),
      event.data.data.port,
    );
  }
});

// self.addEventListener('message', async function (event) {
//   // const clientId = event.source.id;

//   // if (!clientId || !self.clients) {
//   //   return;
//   // }

//   // if (!client) {
//   //   return;
//   // }

//   console.log(event);

//   const allClients = await self.clients.matchAll();
//   // let client = allClients[0];

//   switch (
//     event.data
//     // case 'KEEPALIVE_REQUEST': {
//     //   sendToClient(client, {
//     //     type: 'KEEPALIVE_RESPONSE',
//     //   });
//     //   break;
//     // }

//     // case 'INTEGRITY_CHECK_REQUEST': {
//     //   sendToClient(client, {
//     //     type: 'INTEGRITY_CHECK_RESPONSE',
//     //     payload: INTEGRITY_CHECKSUM,
//     //   });
//     //   break;
//     // }

//     // case 'MOCK_ACTIVATE': {
//     //   activeClientIds.add(clientId);

//     //   sendToClient(client, {
//     //     type: 'MOCKING_ENABLED',
//     //     payload: true,
//     //   });
//     //   break;
//     // }

//     // case 'MOCK_DEACTIVATE': {
//     //   activeClientIds.delete(clientId);
//     //   break;
//     // }

//     // case 'CLIENT_CLOSED': {
//     //   activeClientIds.delete(clientId);

//     //   const remainingClients = allClients.filter((client) => {
//     //     return client.id !== clientId;
//     //   });

//     //   // Unregister itself when there are no more clients
//     //   if (remainingClients.length === 0) {
//     //     self.registration.unregister();
//     //   }

//     //   break;
//     // }
//   ) {
//   }
// });

// Resolve the "master" client for the given event.
// Client that issues a request doesn't necessarily equal the client
// that registered the worker. It's with the latter the worker should
// communicate with during the response resolving phase.
// async function resolveMasterClient(event) {
//   // const client = await self.clients.get(event.clientId);

//   // if (client.frameType === 'top-level') {
//   //   return client;
//   // }

//   const allClients = await self.clients.matchAll();

//   return (
//     allClients.find((client) => {
//       // Find the client ID that's recorded in the
//       // set of clients that have registered the worker.
//       return activeClientIds.has(client.id);
//     }) ?? allClients[0]
//   );
// }

// class Service {
//   // proxy: Remote<{
//   //   getResponse(request: Request, requestId: string): Promise<Response>;
//   // }>;

//   // client;

//   // constructor() {
//   //   this.proxy = wrap({
//   //     addEventListener: (eventName, listener) => {},
//   //     removeEventListener: (eventName, listener) => {},
//   //     dispatchEvent: (event) => {},
//   //   });
//   // }

//   async getResponse(event: FetchEvent, requestId: string) {
//     return await this.proxy.getResponse(event.request, requestId);
//   }
// }

// let services = [];

// const getService = (event): Service => {
//   return services.find(serv => services.)
// };
let channel = new BroadcastChannel('localhost');
let requestPromises = {};

channel.addEventListener('message', (event) => {
  if (event.data.type === 'RESPONSE') {
    const requestId = event.data.requestId;
    const request = requestPromises[requestId];
    if (request) {
      request.resolve(event.data.response);
      delete requestPromises[requestId];
    }
  }
});

async function handleRequest(event: FetchEvent, requestId: string): Promise<Response> {
  let ops;
  let prom = new Promise<Response>((res, rej) => {
    ops = {
      res,
      rej,
    };
  });

  let { params, handlers } = router.find('GET', new URL(event.request.url).pathname);

  if (handlers.length === 0 || event.request.headers.has(bypassHeaderName)) {
    return await fetch(event.request);
  }

  console.log(handlers);
  let handler = handlers.sort((a, b) => {
    return a.priority ?? 0 - b.priority ?? 0;
  })[handlers.length - 1];

  let t = setTimeout(() => {
    fetch(event.request).then((res) => ops.res(res));
  }, 500);

  handler(event.request)
    .then(ops.res, ops.rej)
    .finally(() => {
      clearTimeout(t);
    });

  return await prom;

  // let body = await event.request.clone().text();
  // channel.postMessage({
  //   type: 'HTTP_REQUEST',
  //   data: transferHandlers
  //     .get('HTTP_REQUEST')
  //     .serialize(Object.assign(event.request, { id: requestId, textBody: body })),
  // });

  // const service = await getService(event);
  // const response = await service.getResponse(event, requestId);
  // Send back the response clone for the "response:*" life-cycle events.
  // Ensure MSW is active and ready to handle the message, otherwise
  // this message will pend indefinitely.
  // if (!client) {
  //   return;
  // }
  // // (async function () {
  // const clonedResponse = response.clone();
  // client.dispatchEvent(new CustomEvent('RESPONSE', {
  //     requestId,
  //     type: clonedResponse.type,
  //     ok: clonedResponse.ok,
  //     status: clonedResponse.status,
  //     statusText: clonedResponse.statusText,
  //     body: clonedResponse.body === null ? null : await clonedResponse.text(),
  //     headers: serializeHeaders(clonedResponse.headers),
  //     redirected: clonedResponse.redirected,
  //   });
  // return response;
}

// async function getResponse(event, client, requestId): Promise<Response> {
//   const { request } = event;
//   const requestClone = request.clone();
//   const getOriginalResponse = () => fetch(requestClone);

//   // Bypass mocking when the request client is not active.
//   if (!client) {
//     return getOriginalResponse();
//   }

//   // Bypass requests with the explicit bypass header
//   if (requestClone.headers.get(bypassHeaderName) === 'true') {
//     const cleanRequestHeaders = serializeHeaders(requestClone.headers);

//     // Remove the bypass header to comply with the CORS preflight check.
//     delete cleanRequestHeaders[bypassHeaderName];

//     const originalRequest = new Request(requestClone, {
//       headers: new Headers(cleanRequestHeaders),
//     });

//     return fetch(originalRequest);
//   }

//   // Send the request to the client-side MSW.
//   const reqHeaders = serializeHeaders(request.headers);
//   const body = await request.text();

//   let fetchingFromClient = await self.clients.get(event.clientId);

//   let clients = await self.clients.matchAll();

//   const clientMessage = await sendToClient(client, {
//     type: 'REQUEST',
//     payload: {
//       id: requestId,
//       url: request.url,
//       method: request.method,
//       headers: reqHeaders,
//       cache: request.cache,
//       mode: request.mode,
//       credentials: request.credentials,
//       destination: request.destination,
//       integrity: request.integrity,
//       redirect: request.redirect,
//       referrer: request.referrer,
//       source: { clientId: fetchingFromClient ? fetchingFromClient.id : clients[0].id },
//       referrerPolicy: request.referrerPolicy,
//       body,
//       bodyUsed: request.bodyUsed,
//       keepalive: request.keepalive,
//     },
//   });

//   switch (clientMessage.type) {
//     case 'MOCK_SUCCESS': {
//       return delayPromise(() => respondWithMock(clientMessage), clientMessage.payload.delay);
//     }

//     case 'MOCK_NOT_FOUND': {
//       return getOriginalResponse();
//     }

//     case 'NETWORK_ERROR': {
//       const { name, message } = clientMessage.payload;
//       const networkError = new Error(message);
//       networkError.name = name;

//       // Rejecting a request Promise emulates a network error.
//       throw networkError;
//     }

//     case 'INTERNAL_ERROR': {
//       const parsedBody = JSON.parse(clientMessage.payload.body);

//       console.error(
//         `\
//   [MSW] Uncaught exception in the request handler for "%s %s":

//   ${parsedBody.location}

//   This exception has been gracefully handled as a 500 response, however, it's strongly recommended to resolve this error, as it indicates a mistake in your code. If you wish to mock an error response, please see this guide: https://mswjs.io/docs/recipes/mocking-error-responses\
//   `,
//         request.method,
//         request.url,
//       );

//       return respondWithMock(clientMessage);
//     }
//   }

//   return getOriginalResponse();
// }

self.addEventListener('fetch', function (event) {
  const { request, clientId } = event;
  const accept = request.headers.get('accept') || '';

  // Bypass server-sent events.
  if (accept.includes('text/event-stream')) {
    return;
  }

  // // Bypass navigation requests.
  // if (request.mode === 'navigate') {
  //   return;
  // }

  // Opening the DevTools triggers the "only-if-cached" request
  // that cannot be handled by the worker. Bypass such requests.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  // Bypass all requests when there are no active clients.
  // Prevents the self-unregistered worked from handling requests
  // after it's been deleted (still remains active until the next reload).
  // if (activeClientIds.size === 0) {
  //   return;
  // }

  const requestId = uuidv4();

  return event.respondWith(
    handleRequest(event, requestId).catch((error) => {
      if (error.name === 'NetworkError') {
        console.warn(
          '[MSW] Successfully emulated a network error for the "%s %s" request.',
          request.method,
          request.url,
        );
        return;
      }

      // At this point, any exception indicates an issue with the original request/response.
      console.error(
        `\
  [MSW] Caught an exception from the "%s %s" request (%s). This is probably not a problem with Mock Service Worker. There is likely an additional logging output above.`,
        request.method,
        request.url,
        `${error.name}: ${error.message}`,
      );

      return new Response(null, {
        status: 500,
        statusText: `${error.name}: ${error.message}`,
      });
    }),
  );
});

function serializeHeaders(headers) {
  const reqHeaders = {};
  headers.forEach((value, name) => {
    reqHeaders[name] = reqHeaders[name] ? [].concat(reqHeaders[name]).concat(value) : value;
  });
  return reqHeaders;
}

function delayPromise<T>(cb: () => T, duration): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(cb()), duration);
  });
}

function respondWithMock(clientMessage) {
  return new Response(clientMessage.payload.body, {
    ...clientMessage.payload,
    headers: clientMessage.payload.headers,
  });
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
