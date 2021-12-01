import { wrap } from '../comlink/mod';
import type { Remote } from '../comlink/mod';
import { fromWireValue, toWireValue } from '../comlink/http.handlers';
import type { VirtualFileSystem } from './virtual';
import type { SharedFileSystem } from './shared';
import VirtualFile from './core/virtual_file';
import type Stats from './core/stats';
import type { FileFlagString } from './core/file_flag';

export class RemoteFile extends VirtualFile {
  fsRemote: RemoteFileSystem;
  proxy: Remote<VirtualFile>;
  constructor(path: string, flag: FileFlagString, stats: Stats, port?: MessagePort) {
    super(path, flag, stats);
    this.proxy = wrap(port);
  }

  closeSync() {
    console.log('heree');
    syncFileOpCallXhr(this.getPath(), 'closeSync', []);
  }

  async close() {
    this.proxy.close();
  }

  public writeSync(buffer: Uint8Array, offset: number, length: number, position: number): number {
    console.log('heree');
    return syncFileOpCallXhr(this.getPath(), 'writeSync', [
      buffer,
      offset,
      length,
      position,
    ]) as number;
  }

  async write(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<number> {
    console.log('writingggg');
    return await this.proxy.write(buffer, offset, length, position);
  }

  // readSync(container: Uint8Array, offset: number, length: number, position: number): number {
  //   this.remote.readN(n: );
  // }

  // async write(data: string): Promise<void> {
  //   const { remote, path } = this;
  //   const { write } = await remote.getSharedFileSystem();
  //   return write(path, data);
  // }
}

export interface RemoteFileSystem extends VirtualFileSystem {}
export class RemoteFileSystem {
  closeHandle(path: any) {
    throw new Error('Method not implemented.');
  }
  proxy: Remote<SharedFileSystem>;
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

function syncFileOpCallXhr(path: string, op_code: string, args) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/~file/' + op_code, false);
  xhr.send(JSON.stringify([path, op_code, args.map(toWireValue)]));
  // look ma, i'm synchronous (•‿•)
  console.log('json response', xhr.responseText);
  let result = JSON.parse(xhr.responseText.length > 0 ? xhr.responseText : 'null');
  console.log(result);

  if (result[0]) {
    throw result[0];
  }

  if (!result[1]) {
    throw new Error('No result');
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
  ['exists', 'unlink', 'readlink', 'readdir', , 'rmdir', 'closeHandle'],
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

RemoteFileSystem.prototype.openSync = function (
  this: RemoteFileSystem,
  path: string,
  flag: FileFlagString,
  mode: number,
) {
  let remoteFile = syncOpCallXhr('openSync', [path, flag, mode]) as RemoteFile;
  remoteFile.fsRemote = this;
  return remoteFile;
};
