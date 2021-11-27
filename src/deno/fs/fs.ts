import { VirtualFileSystem } from 'os/kernel/fs';
import { proxy, wrap } from '../comlink';
import type { Remote } from '../comlink';
import type { ExposedFileSystem } from './fs.worker';
import FSWorker from './fs.worker?worker';
import { fromWireValue, toWireValue } from '../transferHandlers';

interface RemoteFileSystem extends VirtualFileSystem {}
class RemoteFileSystem {
  proxy: Remote<ExposedFileSystem>;
  constructor(endpoint, public allowSync: boolean = false) {
    if (endpoint) {
      this.proxy = wrap(endpoint);
    }
  }
}

function syncOpCallXhr(op_code: string, args) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/~fs/' + op_code, false);
  xhr.send(JSON.stringify([op_code, args.map(toWireValue)]));
  // look ma, i'm synchronous (•‿•)
  console.log('json response', xhr.responseText);
  let result = JSON.parse(xhr.responseText.length > 0 ? xhr.responseText : 'null');
  console.log(result);

  if (result[0]) {
    throw result[0];
  }

  const value = fromWireValue(result[1][0]);
  return value;
}

/**
 * Tricky: Define all of the functions that merely forward arguments to the
 * relevant file system, or return/throw an error.
 * Take advantage of the fact that the *first* argument is always the path, and
 * the *last* is the callback function (if async).
 * @todo Can use numArgs to make proxying more efficient.
 * @hidden
 */
function defineFcn(name: string, isSync: boolean, numArgs: number): (...args: any[]) => any {
  if (isSync) {
    return function (this: RemoteFileSystem, ...args: any[]) {
      return syncOpCallXhr(name, args);
    };
  } else {
    return async function (this: RemoteFileSystem, ...args: any[]) {
      return await this.proxy[name](...args);
    };
  }
}

/**
 * @hidden
 */
const fsCmdMap = [
  // 1 arg functions
  ['exists', 'unlink', 'readlink', 'readdir'],
  // 2 arg functions
  ['stat', 'mkdir', 'truncate'],
  // 3 arg functions
  ['open', 'readFile', 'chmod', 'utimes'],
  // 4 arg functions
  ['chown'],
  // 5 arg functions
  ['writeFile', 'appendFile', 'openFile'],
];

for (let i = 0; i < fsCmdMap.length; i++) {
  const cmds = fsCmdMap[i];
  for (const fnName of cmds) {
    (<any>RemoteFileSystem.prototype)[fnName] = defineFcn(fnName, false, i + 1);
    (<any>RemoteFileSystem.prototype)[fnName + 'Sync'] = defineFcn(fnName + 'Sync', true, i + 1);
  }
}

export const remoteFS = new RemoteFileSystem(undefined, true);

try {
  console.log(SharedWorker);

  const sharedFilesWorker = new FSWorker();
  remoteFS.proxy = wrap(sharedFilesWorker);
  console.log('waiting for proxy to get ready');
  await remoteFS.proxy.ready();
  console.log('waiting for proxy to get ready');
} catch (e) {
  console.log('waiting for proxy to get ready', e);
}

export const fs = new VirtualFileSystem(remoteFS);
