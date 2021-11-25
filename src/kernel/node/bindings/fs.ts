import type MountableFileSystem from 'os/kernel/fs/backend/MountableFileSystem';
import type InMemoryFile from 'os/kernel/fs/generic/preload_file';
import type { Kernel } from 'os/kernel/kernel';
import { Buffer } from 'buffer';
export const fsBinding = (kernel: Kernel) => {
  const wrap = <T>(f: () => T, req: undefined): T => {
    let result: T | undefined = undefined;
    let err: Error | undefined = undefined;
    try {
      result = f();
    } catch (e) {
      err = e;
    }
    // if (req) nextTick(() => req.oncomplete(err, result));
    // else if (err) throw err;
    return result as any;
  };

  // class FileHandle {
  //   file: PreloadFile<MountableFileSystem>;
  //   fd: number;
  //   super(file) {
  //     this.file = file;
  //     this.fd = getFdForFile(file);
  //   }
  //   getAsyncId() {
  //     return this.fd;
  //   }
  // }

  class FSReqCallback<ResultType = unknown> {
    constructor(bigint?: boolean) {}
    oncomplete: ((error: Error) => void) | ((error: null, result: ResultType) => void);
    context: ReadFileContext;
    complete(e: Error, r?: ResultType) {
      if (e) {
        (this.oncomplete as (error: Error) => void)(e);
      } else {
        this.oncomplete(null, r);
      }
    }
  }

  async function handlePromise(prom, req) {
    if (req === kUsePromises) {
      return prom;
    } else if (req instanceof FSReqCallback) {
      try {
        let value = await prom;
        req.complete(null, value);
      } catch (e) {
        req.complete(e);
      }
    }
  }

  function asyncify(fn, req, ctx, ...args) {
    if (req !== undefined) {
      let promise = new Promise((resolve, reject) => {
        try {
          resolve(fn(...args));
        } catch (err) {
          reject(err);
        }
      });
      return handlePromise(promise, req);
    } else {
      return fn(...args);
    }
  }

  const kUsePromises: unique symbol = Symbol('usePromises');

  function _open(path: StringOrBuffer, flags: number, mode: number): number | Promise<number> {
    console.log('opening', arguments);
    let file = kernel.fs.openSync(path as string, flags, mode) as InMemoryFile<MountableFileSystem>;

    return kernel.process.addFile(file);
  }

  function open(
    path: StringOrBuffer,
    flags: number,
    mode: number,
    req?: FSReqCallback<number> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ): number | Promise<number> {
    return asyncify(_open, req, ctx, path, flags, mode);
  }

  function openFileHandle(
    path: StringOrBuffer,
    flags: number,
    mode: number,
    req?: FSReqCallback<number> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ): number | Promise<number> {
    return asyncify(_open, req, ctx, path, flags, mode);
  }

  function _read(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): number {
    let file = kernel.process.files[fd];
    const buf = Buffer.allocUnsafe(length);
    debugger;
    if (file) {
      let bytes = file.readSync(buf, offset, length, position === -1 ? 0 : position);

      for (let i = 0; i < length; i++) {
        // 97 is the decimal ASCII value for 'a'.
        buffer[i] = buf[i];
      }

      console.log(fd, file, kernel.process.files);

      return bytes;
    }
  }

  function read(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
    req?: FSReqCallback<number> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ) {
    return asyncify(_read, req, ctx, fd, buffer, offset, length, position);
  }

  function _close(fd: number): void {
    let file = kernel.process.files[fd];
    if (file) {
      file.syncSync();
      delete kernel.process.files[fd];
    }
  }

  function close(
    fd: number,
    req?: FSReqCallback<void> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ): void {
    asyncify(_close, req, ctx, fd);
  }

  const statValues = new Float64Array([
    1458881089, // device ID
    33207, // mode | protection
    1, // # hard links
    0, // owner's user ID
    0, // 4 - owner's group ID
    0, // device ID if special file
    -1, // block size
    8162774324649504, // iNode number
    58232, // 8 - size
    -1, // # blocks
    1484478676521.9932, // last access
    1506412651257.9966, // last modification
    1506412651257.9966, // last iNode modification?
    1484478676521.9932, // creation time?
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);

  function _fstat(fd: number, useBigInt: false): Uint8Array {
    if (fd !== undefined && kernel.process.files[fd]) {
      let file = kernel.process.files[fd];
      return file.getStats().toBuffer();
    }
  }

  function fstat(
    fd: number,
    useBigInt: false,
    req?: FSReqCallback<Float64Array> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ): Float64Array {
    return asyncify(_fstat, req, ctx, fd, useBigInt);
  }

  function _lstat(path: string, useBigInt: false): Float64Array {
    let stats = kernel.fs.statSync(path, true);
    statValues[1] =
      (0xf000 & ((stats.isDirectory() ? 0b0100 : 0b1000) << 12)) | (0x0fff & 0x1b7) /*no clue*/;
    statValues[8] = stats.size;

    return statValues;
  }

  function lstat(
    path: string,
    useBigInt: false,
    req?: FSReqCallback<Float64Array> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ): Float64Array | Promise<Float64Array> {
    return asyncify(_lstat, req, ctx, path, useBigInt);
  }

  function _mkdir(
    path: string,
    mode: number,
    req?: FSReqCallback<void> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ) {}

  function mkdir(
    path: string,
    mode: number,
    req?: FSReqCallback<void> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ): void {
    asyncify(_mkdir, req, ctx, path, mode);
  }

  function writeBuffer(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
    req?: FSReqCallback<number> | typeof kUsePromises,
    ctx?: FSSyncContext,
  ): number {
    return kernel.process.files[fd].writeSync(Buffer.from(buffer), offset, length, position);
  }

  return {
    FSReqCallback,
    open,
    lstat,
    fstat,
    read,
    mkdir,
    // write,
    writeBuffer,
    close,
    openFileHandle,
  };
};

interface ReadFileContext {
  fd: number | undefined;
  isUserFd: boolean | undefined;
  size: number;
  callback: (err?: Error, data?: string | Buffer) => unknown;
  buffers: Buffer[];
  buffer: Buffer;
  pos: number;
  encoding: string;
  err: Error | null;
  signal: unknown /* AbortSignal | undefined */;
}

interface FSSyncContext {
  fd?: number;
  path?: string;
  dest?: string;
  errno?: string;
  message?: string;
  syscall?: string;
  error?: Error;
}

type BufferType = Uint8Array;
type Stream = object;
type StringOrBuffer = string | BufferType;
Float64Array.BYTES_PER_ELEMENT;
