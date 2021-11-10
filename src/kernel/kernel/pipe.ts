import { ApiError, ErrorCode } from '../fs/core/api_error';
import { BaseFile } from '../fs/core/file';
import type { File } from '../fs/core/file';
import type { CallbackOneArg, CallbackTwoArgs } from '../fs/core/file_system';
import type stats from '../fs/core/stats';

declare var Buffer: any;

const CUTOFF = 8192;

let id = 0;

// Pipes have a waiting mechanism,
// A read with not callback until it actually gets the data
export class Pipe {
  bufs: Buffer[] = [];
  id = id++;
  refcount: number = 1; // maybe more accurately a reader count
  readWaiter: Function = undefined;
  writeWaiter: Function = undefined;
  closed: boolean = false;

  writeString(s: string): void {
    let b = new Buffer(s);
    this.writeBuffer(b, 0, b.length, 0, (err: Error, len?: number) => {});
  }

  get bufferLength(): number {
    let len = 0;

    for (let i = 0; i < this.bufs.length; i++) len += this.bufs[i].length;

    return len;
  }

  writeBuffer(
    b: Buffer,
    offset: number,
    length: number,
    pos: number,
    cb: CallbackTwoArgs<number>,
  ): void {
    this.bufs.push(b);
    // call backs readers who were blocked on this pipe
    this.releaseReader();

    if (this.bufferLength <= CUTOFF) {
      cb(undefined, b.length);
    } else {
      if (this.writeWaiter) {
        console.log('ERROR: expected no other write waiter');
      }
      this.writeWaiter = () => {
        cb(undefined, b.length);
      };
    }
  }

  read(buf: Buffer, off: number, len: number, pos: number, cb: CallbackTwoArgs<number>): void {
    if (off !== 0) {
      console.log('ERROR: Pipe.read w/ non-zero offset');
    }

    // there is either some data or the file is closed so no more data can come
    if (this.bufs.length || this.closed) {
      let n = this.copy(buf, off, len, pos);

      this.releaseWriter();
      return cb(undefined, n);
    }

    // at this point, we're waiting on more data or an EOF.
    // we go into reader waiting mode
    this.readWaiter = () => {
      let n = this.copy(buf, 0, len, pos);
      this.releaseWriter();
      cb(undefined, n);
    };
  }

  readSync(buf: Buffer, off: number, len: number, pos: number): number {
    return this.copy(buf, off, len, pos);
  }

  ref(): void {
    this.refcount++;
  }

  unref(): void {
    this.refcount--;
    // if we have a non-zero refcount, or noone is waiting on reads
    if (this.refcount) return;

    this.closed = true;
    if (!this.readWaiter) return;

    this.readWaiter();
    this.readWaiter = undefined;
  }

  private copy(dst: Buffer, offset: number, len: number, pos: number): number {
    let result = 0;
    // ensure pos is a number
    pos = pos ? pos : 0;

    while (this.bufs.length > 0 && len > 0) {
      let src = this.bufs[0];

      let n = src.copy(dst, pos);
      pos += n;
      result += n;
      len -= n;

      if (src.length === n) this.bufs.shift();
      else this.bufs[0] = src.slice(n);
    }

    return result;
  }

  // if any writers are blocked (because the buffer was at
  // capacity) unblock them
  private releaseWriter(): void {
    if (this.writeWaiter) {
      let waiter = this.writeWaiter;
      this.writeWaiter = undefined;
      waiter();
    }
  }

  private releaseReader(): void {
    if (this.readWaiter) {
      let waiter = this.readWaiter;
      this.readWaiter = undefined;
      waiter();
    }
  }

  close(): void {
    this.closed = true;
    this.releaseReader();
    this.releaseWriter();
  }
}

export function isPipe(f: File): f is PipeFile {
  return f instanceof PipeFile;
}

/**
 * A file that is backed by a pipe.
 *
 * Writes are directed to the pipe
 * Reads are read from the pipe as data becomes available.
 */
export class PipeFile extends BaseFile implements File {
  pipe: Pipe;
  writeListener: CallbackTwoArgs<string>;

  constructor(pipe?: Pipe) {
    super();
    if (!pipe) {
      pipe = new Pipe();
    }
    this.pipe = pipe;
  }

  writeSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }

  addEventListener(evName: string, cb: CallbackTwoArgs<string>): void {
    if (evName !== 'write') {
      console.log('eventListener only available on PipeFile for write');
      return;
    }

    this.writeListener = cb;
  }

  read(buf: Buffer, off: number, len: number, pos: number, cb: CallbackOneArg): void {
    if (pos !== -1) {
      return cb(new ApiError(ErrorCode.ESPIPE));
    }
    this.pipe.read(buf, off, len, pos, cb);
  }

  write(buf: Buffer, offset: number, len: number, pos: number, cb: CallbackTwoArgs<number>): void {
    if (pos !== -1) {
      return cb(new ApiError(ErrorCode.ESPIPE));
    }
    this.pipe.writeBuffer(buf, offset, len, pos, cb);

    if (this.writeListener) {
      this.writeListener(undefined, buf.toString('utf-8'));
    }
  }

  stat(cb: (err: any, stats: any) => void): void {
    throw new Error('TODO: PipeFile.stat not implemented');
  }

  readSync(buffer: Buffer, offset: number, length: number, position: number): number {
    return this.pipe.readSync(buffer, offset, length, position);
  }

  ref(): void {
    this.pipe.ref();
  }

  unref(): void {
    this.pipe.unref();
  }

  getPos(): number {
    throw new Error('Method not implemented.');
  }
  statSync(): stats {
    throw new Error('Method not implemented.');
  }
  close(cb: CallbackOneArg): void {
    this.pipe.close();
    cb();
  }
  closeSync(): void {
    this.pipe.close();
  }
  truncate(len: number, cb: CallbackOneArg): void {
    throw new Error('Method not implemented.');
  }
  truncateSync(len: number): void {
    throw new Error('Method not implemented.');
  }
}
