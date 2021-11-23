export * from './comlink';

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

// transferHandlers.set('READABLE_STREAM', {
//   canHandle: (obj): obj is Channel => obj instanceof Channel,
//   serialize: (obj: Channel) => {
//     return [obj, [obj.portToWrap, obj.portToExpose]];
//   },
//   deserialize: (obj) => obj,
// });

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
