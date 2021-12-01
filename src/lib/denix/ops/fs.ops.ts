import { constants } from '$lib/constants';
import { mkdirpSync, mkdirp } from '$lib/fs/utils/util';
import type { DenixProcess } from '../denix';
import { op_sync, op_async, Resource } from '../types';
import type { File } from '$lib/fs/core/file';
import { path } from '$lib/path';
import { Buffer } from 'buffer';
import type { TTY } from '$lib/tty';

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

const getFlagFromOptions = (options: Deno.OpenOptions): number => {
  let flag = constants.fs.O_RDONLY;
  if (options.write) {
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
  op_sync('op_read_sync', function (this: DenixProcess, rid: number, data: Uint8Array) {
    let res = this.getResource(rid) as FileResource;
    return res.readSync(data);
  }),
  op_sync('op_write_sync', function (this: DenixProcess, rid: number, data: Uint8Array) {
    let res = this.getResource(rid) as FileResource;
    return res.writeSync(data);
  }),

  {
    name: 'op_open_async',
    async: async function (
      this: DenixProcess,
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
    sync: function (this: DenixProcess, arg) {
      let file = this.fs.openSync(
        getAbsolutePath(arg.path, this),
        getFlagFromOptions(arg.options),
        arg.mode,
      );
      console.log('opened file');
      return this.addResource(new FileResource(file, arg.path));
    },
  },
  {
    name: 'op_mkdir_sync',
    sync: function (this: DenixProcess, { path, recursive }) {
      if (recursive) {
        mkdirpSync(path, 0x644, this.fs);
      } else {
        this.fs.mkdirSync(path, 0x644);
      }
    },
  },
  {
    name: 'op_mkdir_async',
    async: async function (this: DenixProcess, { path, recursive }) {
      if (recursive) {
        await mkdirp(path, 0x644, this.fs);
      } else {
        await this.fs.mkdir(path, 0x644);
      }
    },
  },

  op_async('op_fstat_async', async function (this: DenixProcess, rid) {
    let file = this.getResource(rid) as FileResource;
    return file.file.statSync();
  }),

  op_sync('op_fstat_sync', function (this: DenixProcess, rid) {
    let file = this.getResource(rid) as FileResource;
    return file.file.statSync();
  }),

  op_async('op_stat_async', async function (this: DenixProcess, { path, lstat }) {
    let stat = await this.fs.stat(getAbsolutePath(path, this), lstat);
    return stat;
  }),

  op_sync('op_seek_sync', function (this: DenixProcess, { rid, offset, whence }) {
    console.log(rid, offset, whence);
    (this.getResource(rid) as FileResource).seekSync(offset, whence);
  }),

  op_sync('op_stat_sync', function (this: DenixProcess, { path, lstat }) {
    let stat = this.fs.statSync(getAbsolutePath(path, this), lstat);
    console.log(stat);
    return stat;
  }),
  op_sync('op_remove_sync', function (this: DenixProcess, { path }) {
    this.fs.unlinkSync(getAbsolutePath(path, this));
  }),
  op_async('op_remove_async', async function (this: DenixProcess, { path, recursive }) {
    let absPath = getAbsolutePath(path, this);
    let stat = await this.fs.stat(absPath, false);

    if (stat.isDirectory) {
      await this.fs.rmdir(absPath);
    } else {
      await this.fs.unlink(absPath);
    }
  }),
  op_sync('op_fdatasync_sync', function (this: DenixProcess, rid) {
    (this.getResource(rid) as FileResource).file.datasyncSync();
  }),

  op_async('op_read_dir_async', async function (this: DenixProcess, dirPath: string) {
    let files = await this.fs.readdir(dirPath);
    let entries: DirEntry[] = [];
    for (var file of files) {
      let stat = await this.fs.stat(path.join(dirPath, file), false);
      entries.push({
        name: file,
        isFile: stat.isFile,
        isDirectory: stat.isDirectory,
        isSymlink: false,
      });
    }

    return entries;
  }),

  op_sync('op_set_raw', function (this: DenixProcess, args: { rid: number }) {
    let stdin = this.resourceTable.get(args.rid) as FileResource;

    if (this.opSync(this.opCode('op_isatty'), args.rid)) {
      console.log(stdin);
      let tty = stdin.file as TTY;
      tty.setRawMode(true);
    }
    // this.env[key] = val;
  }),

  op_sync('op_console_size', function (this: DenixProcess, rid: number) {
    let stdin = this.resourceTable.get(rid) as FileResource;

    if (this.opSync(this.opCode('op_isatty'), rid)) {
      let tty = stdin.file as TTY;
      return tty.getSize();
    }
    // this.env[key] = val;
  }),
  op_sync('op_isatty', function (this: DenixProcess, rid: number) {
    let stdin = this.resourceTable.get(rid) as FileResource;

    return true;
    // this.env[key] = val;
  }),

  op_sync('op_read_dir_sync', function (this: DenixProcess, dirPath: string) {
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

export class FileResource extends Resource {
  $name = 'file';
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
    let nwritten = await this.file.write(container, 0, data.byteLength, this.position);

    console.log(nwritten);
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

function getAbsolutePath(p: string, kernel: DenixProcess): string {
  return path.isAbsolute(p) ? p : path.join(kernel.opSync(kernel.opCode('op_cwd')), p);
}
