import { constants } from '$lib/constants';
import { mkdirpSync, mkdirp } from '$lib/fs/utils/util';
import type { Process } from '../denix';
import { op_sync, op_async, Resource } from '../types';
import type { File } from '$lib/fs/core/file';
import { path } from '$lib/path';
import { Buffer } from 'buffer';
import type { TTY } from 'os/lib/tty/tty';
import { ApiError } from 'os/lib/error';
import type VirtualFile from 'os/lib/fs/core/virtual_file';

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
  op_sync('op_read_sync', function (this: Process, rid: number, data: Uint8Array) {
    let res = this.getResource(rid) as FileResource;
    return res.readSync(data);
  }),
  op_sync('op_write_sync', function (this: Process, rid: number, data: Uint8Array) {
    let res = this.getResource(rid) as FileResource;
    return res.writeSync(data);
  }),

  {
    name: 'op_open_async',
    async: async function (
      this: Process,
      arg: { path: string; options: Deno.OpenOptions; mode: number },
    ) {
      let file = await this.fs.open(
        getAbsolutePath(arg.path, this),
        getFlagFromOptions(arg.options),
        arg.mode,
      );

      return this.addResource(new FileResource(file));
    },
  },
  {
    name: 'op_open_sync',
    sync: function (this: Process, arg) {
      let file = this.fs.openSync(
        getAbsolutePath(arg.path, this),
        getFlagFromOptions(arg.options),
        arg.mode,
      );
      console.log('opened file');
      return this.addResource(new FileResource(file));
    },
  },
  {
    name: 'op_mkdir_sync',
    sync: function (this: Process, { path, recursive }) {
      if (recursive) {
        mkdirpSync(path, 0x644, this.fs);
      } else {
        this.fs.mkdirSync(path, 0x644);
      }
    },
  },
  {
    name: 'op_mkdir_async',
    async: async function (this: Process, { path, recursive }) {
      if (recursive) {
        await mkdirp(path, 0x644, this.fs);
      } else {
        await this.fs.mkdir(path, 0x644);
      }
    },
  },

  op_async('op_fstat_async', async function (this: Process, rid) {
    let file = this.getResource(rid) as FileResource;
    return file.file.stat();
  }),

  op_sync('op_fstat_sync', function (this: Process, rid) {
    let file = this.getResource(rid) as FileResource;
    return file.file.statSync();
  }),

  op_async('op_stat_async', async function (this: Process, { path, lstat }) {
    let stat = await this.fs.stat(getAbsolutePath(path, this), lstat);
    return stat;
  }),

  op_sync('op_seek_sync', function (this: Process, { rid, offset, whence }) {
    console.log(rid, offset, whence);
    (this.getResource(rid) as FileResource).seekSync(offset, whence);
  }),

  op_sync('op_stat_sync', function (this: Process, { path, lstat }) {
    let stat = this.fs.statSync(getAbsolutePath(path, this), lstat);
    console.log(stat);
    return stat;
  }),
  op_sync('op_remove_sync', function (this: Process, { path }) {
    this.fs.unlinkSync(getAbsolutePath(path, this));
  }),
  op_async('op_remove_async', async function (this: Process, { path, recursive }) {
    let absPath = getAbsolutePath(path, this);
    let stat = await this.fs.stat(absPath, false);

    if (stat.isDirectory) {
      await this.fs.rmdir(absPath);
    } else {
      await this.fs.unlink(absPath);
    }
  }),
  op_sync('op_fdatasync_sync', function (this: Process, rid) {
    (this.getResource(rid) as FileResource).file.datasyncSync();
  }),

  op_async('op_read_dir_async', async function (this: Process, dirPath: string) {
    dirPath = getAbsolutePath(dirPath, this);
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

  op_sync('op_set_raw', function (this: Process, args: { rid: number; mode }) {
    let stdin = this.getResource(args.rid) as FileResource;

    if (this.opSync(this.opCode('op_isatty'), args.rid)) {
      console.log(stdin);
      let tty = stdin.file as TTY;
      console.log(tty);
      this.tty.setRawMode(args.mode);
    }
    // this.env[key] = val;
  }),

  op_sync('op_console_size', function (this: Process, rid: number) {
    let stdin = this.getResource(rid) as FileResource;

    if (this.opSync(this.opCode('op_isatty'), rid)) {
      let tty = stdin.file as TTY;
      return tty.getSize();
    }
    // this.env[key] = val;
  }),
  op_sync('op_isatty', function (this: Process, rid: number) {
    let stdin = this.getResource(rid) as FileResource;

    return true;
    // this.env[key] = val;
  }),

  op_sync('op_read_dir_sync', function (this: Process, dirPath: string) {
    dirPath = getAbsolutePath(dirPath, this);
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

  op_sync('op_chdir', function (this: Process, path) {
    let p = getAbsolutePath(path, this);
    if (!this.fs.existsSync(p)) {
      throw ApiError.ENOENT(p);
    }
    this.cwd = p;
  }),
];

class ConsoleLogResource extends Resource {
  type = 'console';
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
  type = 'file';
  constructor(public file: VirtualFile) {
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
    if (stat.size > 0 && this.position >= stat.size) {
      return null;
    }
    let container = new Uint8Array(new SharedArrayBuffer(data.length));
    let nread = await this.file.read(container, this.position, data.byteLength, 0);

    console.log(container);

    data.set(container, 0);

    this.position += nread;

    return nread;
  }

  readSync(data: Uint8Array) {
    let stat = this.file.statSync();
    if (stat.size > 0 && this.position >= stat.size) {
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

function getAbsolutePath(p: string, kernel: Process): string {
  return path.isAbsolute(p) ? p : path.join(kernel.opSync(kernel.opCode('op_cwd')), p);
}
