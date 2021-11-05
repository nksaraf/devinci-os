import FS from '@isomorphic-git/lightning-fs';
import path from '@isomorphic-git/lightning-fs/src/path';
import mitt from 'mitt';

let fsEvents = mitt();

fsEvents.on('*', console.log);

let internalFs = new FS('fs', {
  wipe: true,
});

let promisesProxy = new Proxy(internalFs.promises, {
  get(target, propKey, receiver) {
    let originialFn = target[propKey];

    if (typeof originialFn === 'function') {
      return (...args) => {
        fsEvents.emit(propKey, { args });
        return target[propKey](...args);
      };
    }

    return originialFn;
  },
});

export const fs: FS & { events: typeof fsEvents } = new Proxy(internalFs as any, {
  get(target, propKey, receiver) {
    if (propKey === 'promises') {
      return promisesProxy;
    }

    if (propKey === 'events') {
      return fsEvents;
    }

    let originialFn = target[propKey];
    if (typeof originialFn === 'function') {
      return (...args) => {
        return target[propKey](...args);
      };
    }

    return originialFn;
  },
});

export { path };

// @ts-ignore
window.fs = fs.promises;
export default fs;
