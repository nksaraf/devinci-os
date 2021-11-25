export * from './comlink';

import type { MockedRequest, MockedResponse } from 'msw';
import { transferHandlers } from './comlink';

export class Channel {
  portToExpose: MessagePort;
  portToWrap: MessagePort;
}

transferHandlers.set('ARRAY_BUFFER', {
  canHandle: (obj): obj is Uint8Array =>
    obj instanceof Uint8Array && obj.buffer instanceof ArrayBuffer,
  serialize: (obj: Uint8Array) => {
    return [obj, [obj.buffer]];
  },
  deserialize: (obj) => obj,
});

transferHandlers.set('MESSAGE_PORT', {
  canHandle: (obj): obj is MessagePort => obj instanceof MessagePort,
  serialize: (obj: MessagePort) => {
    return [obj, [obj]];
  },
  deserialize: (obj) => obj,
});

transferHandlers.set('CHANNEL', {
  canHandle: (obj): obj is Channel => obj instanceof Channel,
  serialize: (obj: Channel) => {
    return [obj, [obj.portToWrap, obj.portToExpose]];
  },
  deserialize: (obj) => obj,
});

transferHandlers.set('READABLE_STREAM', {
  canHandle: (obj): obj is ReadableStream => obj instanceof ReadableStream,
  serialize: (obj: ReadableStream) => {
    return [obj, [obj]];
  },
  deserialize: (obj) => obj,
});

transferHandlers.set('EVENT', {
  canHandle: (obj): obj is CustomEvent => obj instanceof CustomEvent,
  serialize: (ev: CustomEvent) => {
    return [
      {
        type: ev.type,
        detail: ev.detail,
      },
      [],
    ];
  },
  deserialize: (obj: any) => new CustomEvent(obj.type, { detail: obj.detail }),
});

function serializeHeaders(headers) {
  const reqHeaders = {};
  headers.forEach((value, name) => {
    reqHeaders[name] = reqHeaders[name] ? [].concat(reqHeaders[name]).concat(value) : value;
  });
  return reqHeaders;
}

interface SerializedRequest {
  integrity: string;
  redirect: RequestRedirect;
  referrer: string;
  referrerPolicy: ReferrerPolicy;
  body: BodyInit;
  bodyUsed: any;
  id: any;
  url: string;
  method: string;
  headers: {};
  cache: RequestCache;
  mode: RequestMode;
  credentials: RequestCredentials;
  destination: RequestDestination;
  keepalive: boolean;
}

transferHandlers.set('HTTP_REQUEST', {
  canHandle: (obj): obj is Request => obj instanceof Request,
  serialize: (request: Request): [MockedRequest, Transferable[]] => {
    const reqHeaders = serializeHeaders(request.headers);
    return [
      {
        id: request.id,
        url: request.url,
        method: request.method,
        headers: reqHeaders,
        cache: request.cache,
        mode: request.mode,
        credentials: request.credentials,
        destination: request.destination,
        integrity: request.integrity,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        // @ts-ignore
        body: request.textBody,
        bodyUsed: request.bodyUsed,
        keepalive: request.keepalive,
        cookies: {},
        // cookies: request.cookies,
      },
      [],
    ];
  },
  deserialize: (obj: SerializedRequest) => {
    return new Request(obj.url, {
      method: obj.method,
      headers: obj.headers,
      cache: obj.cache,
      mode: obj.mode,
      credentials: obj.credentials,
      integrity: obj.integrity,
      redirect: obj.redirect,
      referrer: obj.referrer,
      referrerPolicy: obj.referrerPolicy,
      body: obj.body,
      keepalive: obj.keepalive,
    });
  },
});

transferHandlers.set('HTTP_RESPONSE', {
  canHandle: (obj): obj is Response => obj instanceof Response,
  serialize: (request: Response): [MockedResponse, Transferable[]] => {
    const reqHeaders = serializeHeaders(request.headers);
    return [
      {
        url: request.url,
        status: request.status,
        statusText: request.statusText,
        body: request.body,
        headers: reqHeaders,
        cookies: {},
        // cookies: request.cookies,
      },
      [request.body],
    ];
  },
  deserialize: (obj: MockedResponse) => {
    return new Response(obj.body, {
      headers: obj.headers,
      status: obj.status,
      statusText: obj.statusText,
    });
  },
});
