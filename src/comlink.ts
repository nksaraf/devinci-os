import { transferHandlers } from 'comlink';

transferHandlers.set('ARRAY_BUFFER', {
  canHandle: (obj) => obj instanceof Uint8Array,
  serialize: (obj) => {
    return [obj, [obj.buffer]];
  },
  deserialize: (obj) => obj,
});
