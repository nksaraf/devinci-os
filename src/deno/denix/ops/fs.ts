import { Resource } from 'os/deno/denix/interfaces';
import type { Kernel } from '../denix';
import { op_sync, op_async } from '../interfaces';
import type { File } from 'os/kernel/fs/core/file';
import { constants } from 'os/kernel/kernel/constants';
import { Buffer } from 'buffer';
import path from 'path-browserify';
import { newPromise } from 'os/deno/util';
import { remoteFS } from 'os/deno/fs';
import { mkdirp, mkdirpSync } from 'os/kernel/fs/core/util';

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

const getFlagFromOptions = (options: Deno.OpenOptions): number => {
  let flag = constants.fs.O_RDONLY;
  if (options.read && options.write) {
    flag |= constants.fs.O_RDWR;
  }

  if (options.create) {
    flag |= constants.fs.O_CREAT;
  }

  if (options.truncate) {
    flag |= constants.fs.O_TRUNC;
  }

  if (options.append) {
    flag |= constants.fs.O_APPEND;
  }
  return flag;
};

export const fsOps = [
  op_sync('op_read_sync', function (this: Kernel, rid: number, data: Uint8Array) {
    let res = this.getResource(rid) as FileResource;
    return res.readSync(data);
  }),
  op_sync('op_write_sync', function (this: Kernel, rid: number, data: Uint8Array) {
    let res = this.getResource(rid) as FileResource;
    return res.writeSync(data);
  }),

  {
    name: 'op_open_async',
    async: async function (
      this: Kernel,
      arg: { path: string; options: Deno.OpenOptions; mode: number },
    ) {
      let file = await this.fs.open(
        getAbsolutePath(arg.path, this),
        getFlagFromOptions(arg.options),
        arg.mode,
      );

      return this.addResource(new FileResource(file, arg.path));
    },
  },
  {
    name: 'op_open_sync',
    sync: function (this: Kernel, arg) {
      let file = this.fs.openSync(getAbsolutePath(arg.path, this), constants.fs.O_RDWR, arg.mode);
      return this.addResource(new FileResource(file, arg.path));
    },
  },
  {
    name: 'op_mkdir_sync',
    sync: function (this: Kernel, { path, recursive }) {
      if (recursive) {
        mkdirpSync(path, 0x644, this.fs);
      } else {
        this.fs.mkdirSync(path, 0x644);
      }
    },
  },
  {
    name: 'op_mkdir_async',
    async: async function (this: Kernel, { path, recursive }) {
      if (recursive) {
        await mkdirp(path, 0x644, this.fs);
      } else {
        await this.fs.mkdir(path, 0x644);
      }
    },
  },

  op_async('op_fstat_async', async function (this: Kernel, rid) {
    let file = this.getResource(rid) as FileResource;
    return file.file.statSync();
  }),

  op_sync('op_fstat_sync', function (this: Kernel, rid) {
    let file = this.getResource(rid) as FileResource;
    return file.file.statSync();
  }),

  op_async('op_stat_async', async function (this: Kernel, { path, lstat }) {
    let stat = await this.fs.stat(getAbsolutePath(path, this), lstat);
    return stat;
  }),

  op_sync('op_seek_sync', function (this: Kernel, { rid, offset, whence }) {
    console.log(rid, offset, whence);
    (this.getResource(rid) as FileResource).seekSync(offset, whence);
  }),

  op_sync('op_stat_sync', function (this: Kernel, { path, lstat }) {
    let stat = this.fs.statSync(getAbsolutePath(path, this), lstat);
    console.log(stat);
    return stat;
  }),
  op_sync('op_remove_sync', function (this: Kernel, { path }) {
    this.fs.unlinkSync(getAbsolutePath(path, this));
  }),
  op_sync('op_fdatasync_sync', function (this: Kernel, rid) {
    (this.getResource(rid) as FileResource).file.datasyncSync();
  }),

  op_async('op_read_dir_async', async function (this: Kernel, dirPath: string) {
    return await remoteFS.proxy.readDir(dirPath);
    // return new Promise((res, rej) => {
    //   // this.fs.readdir(dirPath, (e, d) => {
    //   //   if (e) {
    //   //     throw e;
    //   //   }

    //   //   (async () => {
    //   //     res(
    //   //       await Promise.all(
    //   //         d.map((p) => {
    //   //           const prom = newPromise();
    //   //           debugger;
    //   //           this.fs.stat(path.join(dirPath, p), false, (e, stat) => {
    //   //             if (e) {
    //   //               prom.reject(e);
    //   //             }

    //   //             console.log(stat);

    //   //             prom.resolve({
    //   //               name: p,
    //   //               isFile: stat.isFile,
    //   //               isDirectory: stat.isDirectory,
    //   //             });
    //   //           });
    //   //           return prom.promise;
    //   //         }),
    //   //       ),
    //   //     );
    //   //   })();
    //   // });
    // });
  }),

  op_sync('op_read_dir_sync', function (this: Kernel, dirPath: string) {
    return this.fs.readdirSync(dirPath).map((p) => {
      let stat = this.fs.statSync(path.join(dirPath, p), false);
      return {
        name: p,
        isFile: stat.isFile,
        isDirectory: stat.isDirectory,
        isSymbolicLink: stat.isSymbolicLink,
      };
    });
  }),
];

class ConsoleLogResource extends Resource {
  name = 'console';
  async read(data: Uint8Array) {
    return 0;
  }
  async write(data: Uint8Array) {
    let str = new TextDecoder().decode(data);
    // console.log(str);
    console.log(str);
    return data.length;
  }
  close() {
    //
  }
  shutdown() {
    return Promise.resolve();
  }
}

class FileResource extends Resource {
  constructor(public file: File, public name: string) {
    super();
  }

  position = 0;

  seekSync(offset: number, whence: Deno.SeekMode) {
    if (whence === (0 as Deno.SeekMode.Start)) {
      this.position = offset;
    }
    return this.position;
  }

  async seek(offset: number, whence: Deno.SeekMode) {
    if (whence === (0 as Deno.SeekMode.Start)) {
      this.position = offset;
    }
    return this.position;
  }

  async read(data: Uint8Array) {
    let stat = await this.file.stat();
    if (this.position >= stat.size) {
      return null;
    }
    let container = new Uint8Array(new SharedArrayBuffer(data.length));
    let nread = await this.file.read(
      container,
      this.position,
      Math.min(stat.size, data.byteLength),
      0,
    );

    console.log(container);

    data.set(container, 0);

    this.position += nread;

    return nread;
  }

  readSync(data: Uint8Array) {
    if (this.position >= this.file.statSync().size) {
      return null;
    }
    let container = Buffer.from(data);
    let nread = this.file.readSync(
      container,
      this.position,
      Math.min(this.file.statSync().size - this.position, data.byteLength),
      0,
    );

    data.set(container, 0);

    this.position += nread;

    return nread;
  }

  async write(data: Uint8Array) {
    let container = Buffer.from(data);
    let nwritten = this.file.writeSync(container, 0, data.byteLength, this.position);

    this.position += nwritten;

    return nwritten;
  }

  writeSync(data: Uint8Array) {
    let container = Buffer.from(data);
    let nwritten = this.file.writeSync(container, 0, data.byteLength, this.position);

    this.position += nwritten;

    return nwritten;
  }

  close() {
    this.file.closeSync();
  }
}

function getAbsolutePath(p: string, kernel: Kernel): string {
  return path.isAbsolute(p) ? p : path.join(kernel.opSync(kernel.opCode('op_cwd')), p);
}
