import { Resource } from 'os/deno/denix/interfaces';
import type { Kernel } from '../denix';
import { op_sync, op_async } from '../interfaces';
import type { File } from 'os/kernel/fs/core/file';
import { constants } from 'os/kernel/kernel/constants';
import { Buffer } from 'buffer';
import path from 'path-browserify';
export const fsOps = [
  op_sync('op_read_sync', function (this: Kernel, rid, data) {
    let res = this.getResource(rid) as FileResource;
    return res.readSync(data);
  }),
  op_sync('op_write_sync', function (this: Kernel, rid, data) {
    let res = this.getResource(rid) as FileResource;
    return res.writeSync(data);
  }),

  {
    name: 'op_open_async',
    async: async function (this: Kernel, arg) {
      let file = this.fs.openSync(getAbsolutePath(arg.path, this), constants.fs.O_RDWR, arg.mode);
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
      this.fs.mkdirSync(path, 0x644, { recursive });
    },
  },
  {
    name: 'op_mkdir_async',
    async: async function (this: Kernel, { path, recursive }) {
      this.fs.mkdirSync(path, 0x644, { recursive });
    },
  },

  op_async('op_fstat_async', async function (this: Kernel, rid) {
    let file = this.getResource(rid) as FileResource;
    let stat = file.file.statSync();
    return {
      size: stat.size,
      mode: stat.mode,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      isSymbolicLink: stat.isSymbolicLink(),
    };
  }),

  op_sync('op_fstat_sync', function (this: Kernel, rid) {
    let file = this.getResource(rid) as FileResource;
    let stat = file.file.statSync();
    return {
      size: stat.size,
      mode: stat.mode,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      isSymbolicLink: stat.isSymbolicLink(),
    };
  }),

  op_async('op_stat_async', async function (this: Kernel, { path, lstat }) {
    let stat = this.fs.statSync(getAbsolutePath(path, this), lstat);
    return {
      size: stat.size,
      mode: stat.mode,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      isSymbolicLink: stat.isSymbolicLink(),
    };
  }),

  op_sync('op_seek_sync', function (this: Kernel, { rid, offset, whence }) {
    console.log(rid, offset, whence);
    (this.getResource(rid) as FileResource).seekSync(offset, whence);
  }),

  op_sync('op_stat_sync', function (this: Kernel, { path, lstat }) {
    let stat = this.fs.statSync(getAbsolutePath(path, this), lstat);
    console.log(stat);
    return {
      size: stat.size,
      mode: stat.mode,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      isSymbolicLink: stat.isSymbolicLink(),
    };
  }),
  op_sync('op_remove_sync', function (this: Kernel, { path }) {
    this.fs.unlinkSync(getAbsolutePath(path, this));
  }),
  op_sync('op_fdatasync_sync', function (this: Kernel, rid) {
    (this.getResource(rid) as FileResource).file.datasyncSync();
  }),

  op_async('op_read_dir_async', async function (this: Kernel, dirPath: string) {
    return this.fs.readdirSync(dirPath).map((p) => {
      let stat = this.fs.statSync(path.join(dirPath, p), false);
      return {
        name: p,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        isSymbolicLink: stat.isSymbolicLink(),
      };
    });
  }),

  op_sync('op_read_dir_sync', function (this: Kernel, dirPath: string) {
    return this.fs.readdirSync(dirPath).map((p) => {
      let stat = this.fs.statSync(path.join(dirPath, p), false);
      return {
        name: p,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        isSymbolicLink: stat.isSymbolicLink(),
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

  seekSync(offset: number, whence: number) {
    if (whence === (0 as Deno.SeekMode.Start)) {
      this.position = offset;
    }
    return this.position;
  }

  async read(data: Uint8Array) {
    if (this.position >= this.file.statSync().size) {
      return null;
    }
    let container = Buffer.from(data);
    let nread = this.file.readSync(
      container,
      this.position,
      Math.min(this.file.statSync().size, data.byteLength),
      0,
    );

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
