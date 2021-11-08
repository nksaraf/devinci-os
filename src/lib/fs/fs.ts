import './index';
import type { FileSystem, FileSystemConstructor } from './core/file_system';
import HttpRequest from './backend/HttpRequest';
import MountableFileSystem from './backend/MountableFileSystem';
import fs from '../node/fs';
import mitt from 'mitt';

type Args<T extends FileSystemConstructor> = Parameters<T['Create']>;
type CallbackType<T extends FileSystemConstructor> = Args<T>[1];
type System<T extends FileSystemConstructor> = Parameters<CallbackType<T>>[1];

function createFileSystemBackend<T extends FileSystemConstructor>(
  backend: T,
  options: any,
): Promise<System<T>> {
  return new Promise<System<T>>((resolve, reject) =>
    backend.Create(options, (err, fileSystemBackend) => {
      if (err) {
        reject(err);
      } else {
        resolve(fileSystemBackend);
      }
    }),
  );
}

export let events = mitt();

console.log(fs);

async function createFileSystem() {
  // InMemoryFileSystem.Create({}, (err, memFS) => {
  //   window._fs = memFS;
  //   nodeFS = new NodeFileSystem();
  //   (nodeFS as NodeFileSystem).initialize(memFS);
  let httpFS = await createFileSystemBackend(HttpRequest, {
    index: '/node/index.json',
    baseUrl: '/node/',
  });

  let mountFS = await createFileSystemBackend(MountableFileSystem, {
    '/@node': httpFS,
  });

  fs.initialize(mountFS);
  // HTTPRequest.Create(
  //   {
  //     index: 'http://mysite.com/files/index.json',
  //   },
  //   function (e, xhrfs) {
  //     MountableFileSystem.Create(
  //       {
  //         '/data': xhrfs,
  //       },
  //       function (e, mfs) {
  //         BrowserFS.initialize(mfs);

  //         InMemoryFileSystem.Create({}, (err, memFS) => {

  //         }
  //         // Added after-the-fact...
  //         // LocalStorage.Create(function (e, lsfs) {
  //         //   mfs.mount('/home', lsfs);
  //         // });
  //       },
  //     );
  //   },
  // );
  // window.fs = nodeFS;
  // });

  fs.events = events;

  return mountFS;
}

declare global {
  interface Window {
    fs: typeof fs;
    _fs: FileSystem;
  }
}

export const promise = createFileSystem();
export const node = fs;
export default fs;
