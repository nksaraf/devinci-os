import { ApiError, ErrorCode } from '../fs/core/api_error';
import type { File } from '../fs/core/file';
import type { CallbackOneArg, CallbackTwoArgs } from '../fs/core/file_system';
import type stats from '../fs/core/stats';
import InMemoryFileSystem from '../fs/backend/InMemory';
import VirtualFile from '../fs/generic/virtual_file';

declare var Buffer: any;

const CUTOFF = 8192;

let id = 0;

// Pipes have a waiting mechanism,
// A read with not callback until it actually gets the data
export class Pipe {
  writeBufferSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }
  bufs: Buffer[] = [];
  id = id++;
  refcount: number = 1; // maybe more accurately a reader count
  readWaiter: Function = undefined;
  writeWaiter: Function = undefined;
  closed: boolean = false;

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

  readBuffer(
    buf: Buffer,
    off: number,
    len: number,
    pos: number,
    cb: CallbackTwoArgs<number>,
  ): void {
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

  readBufferSync(buf: Buffer, off: number, len: number, pos: number): number {
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
  protected releaseWriter(): void {
    if (this.writeWaiter) {
      let waiter = this.writeWaiter;
      this.writeWaiter = undefined;
      waiter();
    }
  }

  // tell readers that something was written finally,
  // and they can now read it
  protected releaseReader(): void {
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

export class MessageChannelPipe extends Pipe {
  port: MessagePort;
  constructor(port: MessagePort) {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      this.onBufferReceived();
    };
  }

  writeBuffer(
    b: Buffer,
    offset: number,
    length: number,
    pos: number,
    cb: CallbackTwoArgs<number>,
  ): void {
    this.appendBuffer(b);
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

  appendBuffer(buffer: Buffer) {
    this.port.postMessage(buffer, [buffer]);
  }

  onBufferReceived() {}
}

export function isPipe(f: File): f is PipeFile {
  return f instanceof PipeFile;
}

enum PipeMode {
  Read = 1,
  Write = 2,
}

export class PipeFileSystem extends InMemoryFileSystem {}

/**
 * A file that is backed by a pipe.
 *
 * Writes are directed to the pipe
 * Reads are read from the pipe as data becomes available.
 */
export class PipeFile extends VirtualFile implements File {
  writeListener: CallbackTwoArgs<string>;

  constructor(public pipe: Pipe, public mode: PipeMode, public port: MessagePort) {
    let fd = kernel.process.getNextFD();
    super(fd, kernel.process, '/dev/fd/' + fd, mode === PipeMode.Read ? 'r' : 'w');
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

  readBuffer(buf: Buffer, off: number, len: number, pos: number, cb: CallbackOneArg): void {
    if (this.mode !== PipeMode.Read) {
      console.log('ERROR: PipeFile.read called on non-read pipe');
    }

    if (pos !== -1) {
      return cb(new ApiError(ErrorCode.ESPIPE));
    }

    this.pipe.readBuffer(buf, off, len, pos, cb);
  }

  writeBuffer(
    buf: Buffer,
    offset: number,
    len: number,
    pos: number,
    cb: CallbackTwoArgs<number>,
  ): void {
    if (this.mode !== PipeMode.Read) {
      console.log('ERROR: PipeFile.read called on non-read pipe');
    }

    this.pipe.writeBuffer(buf, offset, len, pos, cb);

    if (this.writeListener) {
      this.writeListener(undefined, buf.toString('utf-8'));
    }
  }

  stat(cb: (err: any, stats: any) => void): void {
    throw new Error('TODO: PipeFile.stat not implemented');
  }

  readBufferSync(buffer: Buffer, offset: number, length: number, position: number): number {
    return this.pipe.readBufferSync(buffer, offset, length, position);
  }
  writeBufferSync(buffer: Buffer, offset: number, length: number, position: number): number {
    return this.pipe.writeBufferSync(buffer, offset, length, position);
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

function createPipe() {
  const messageChannel = new MessageChannel();
  const [port1, port2] = [messageChannel.port1, messageChannel.port2];

  new MessageChannelPipe(port1);

  kernel.proc

  const pipe = new Pipe();
}
