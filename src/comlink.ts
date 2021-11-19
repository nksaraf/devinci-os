import { transferHandlers } from 'comlink';

transferHandlers.set('ARRAY_BUFFER', {
  canHandle: (obj) => obj instanceof Uint8Array && obj.buffer instanceof ArrayBuffer,
  serialize: (obj) => {
    return [obj, [obj.buffer]];
  },
  deserialize: (obj) => obj,
});
