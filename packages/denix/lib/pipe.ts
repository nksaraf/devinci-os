import { newPromise } from '$lib/promise.ts';

const CUTOFF = 8192;

let id = 0;

// Pipes have a waiting mechanism,
// A read with not callback until it actually gets the data
export class InMemoryPipe {
  bufs: Uint8Array[] = [];
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

  async writeBuffer(b: Uint8Array, offset: number, length: number, pos: number): Promise<number> {
    this.bufs.push(b);
    // call backs readers who were blocked on this pipe
    this.releaseReader();

    if (this.bufferLength <= CUTOFF) {
      return b.length;
    } else {
      if (this.writeWaiter) {
        console.debug('ERROR: expected no other write waiter');
      }

      let promise = newPromise<number>();
      this.writeWaiter = () => {
        promise.resolve(b.length);
      };

      return await promise.promise;
    }
  }

  async readBuffer(buf: Uint8Array, off: number, len: number, pos: number): Promise<number> {
    // there is either some data or the file is closed so no more data can come
    if (this.bufs.length || this.closed) {
      let n = this.copy(buf, off, len, pos);

      this.releaseWriter();
      return n;
    }

    let promise = newPromise<number>();
    // at this point, we're waiting on more data or an EOF.
    // we go into reader waiting mode
    this.readWaiter = () => {
      let n = this.copy(buf, 0, len, pos);
      this.releaseWriter();
      promise.resolve(n);
    };

    return await promise.promise;
  }

  readBufferSync(buf: Uint8Array, off: number, len: number, pos: number): number {
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

  private copy(dst: Uint8Array, offset: number, len: number, pos: number): number {
    let result = 0;
    // ensure pos is a number
    pos = pos ? pos : 0;

    while (this.bufs.length > 0 && len > 0) {
      let src = this.bufs[0];
      let n = src.length;
      dst.set(src, pos);
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

// export class MessageChannelPipe extends InMemoryPipe {
//   port: MessagePort;
//   constructor(port: MessagePort) {
//     super();
//     this.port.onmessage = (e: MessageEvent) => {
//       this.onBufferReceived();
//     };
//   }

//   async writeBuffer(b: Buffer, offset: number, length: number, pos: number): Promise<number> {
//     this.appendBuffer(b);
//     // call backs readers who were blocked on this pipe
//     this.releaseReader();

//     if (this.bufferLength <= CUTOFF) {
//       cb(undefined, b.length);
//     } else {
//       if (this.writeWaiter) {
//         console.debug('ERROR: expected no other write waiter');
//       }
//       this.writeWaiter = () => {
//         cb(undefined, b.length);
//       };
//     }
//   }

//   appendBuffer(buffer: Buffer) {
//     this.port.postMessage(buffer, [buffer]);
//   }

//   onBufferReceived() {}
// }

// export function isPipe(f: File): f is PipeFile {
//   return f instanceof PipeFile;
// }

enum PipeMode {
  Read = 1,
  Write = 2,
}

/**
 * A file that is backed by a pipe.
 *
 * Writes are directed to the pipe
 * Reads are read from the pipe as data becomes available.
 */
// export class PipeFile extends VirtualFile implements File {
//   writeListener: CallbackTwoArgs<string>;

//   supportsSynch(): boolean {
//     return false;
//   }

//   constructor(public pipe: InMemoryPipe, public mode: PipeMode) {
//     super('/dev/pipe/' + 0, mode === PipeMode.Read ? );
//   }

//   addEventListener(evName: string): Promise<string> {
//     if (evName !== 'write') {
//       console.debug('eventListener only available on PipeFile for write');
//       return;
//     }

//     this.writeListener = cb;
//   }

//   readBuffer(buf: Buffer, off: number, len: number, pos: number): Promise<void> {
//     if (this.mode !== PipeMode.Read) {
//       console.debug('ERROR: PipeFile.read called on non-read pipe');
//     }

//     if (pos !== -1) {
//       return cb(new ApiError(ErrorCode.ESPIPE));
//     }

//     this.pipe.readBuffer(buf, off, len, pos, cb);
//   }

//   writeBuffer(buf: Buffer, offset: number, len: number, pos: number): void {
//     if (this.mode !== PipeMode.Write) {
//       console.debug('ERROR: PipeFile.read called on non-read pipe');
//     }

//     await this.pipe.writeBuffer(buf, offset, len, pos);

//     if (this.writeListener) {
//       this.writeListener(undefined, buf.toString('utf-8'));
//     }
//   }

//   stat(): Promise<Stats> {
//     throw new Error('TODO: PipeFile.stat not implemented');
//   }

//   ref(): void {
//     this.pipe.ref();
//   }

//   unref(): void {
//     this.pipe.unref();
//   }

//   getPos(): number {
//     throw new Error('Method not implemented.');
//   }

//   statSync(): stats {
//     throw new Error('Method not implemented.');
//   }

//   async close(): Promise<void> {
//     this.pipe.close();
//   }

//   closeSync(): void {
//     this.pipe.close();
//   }

//   truncate(len: number): Promise<void> {
//     throw new Error('Method not implemented.');
//   }

//   truncateSync(len: number): void {
//     throw new Error('Method not implemented.');
//   }
// }
