import type MountableFileSystem from 'os/lib/fs/backend/MountableFileSystem';
import { FileFlag } from 'os/lib/fs/core/file_flag';
import type PreloadFile from 'os/lib/fs/generic/preload_file';
import { Kernel } from 'os/lib/kernel';
import { constants } from '../constants';

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

class FileHandle {
  file: PreloadFile<MountableFileSystem>;
  fd: number;
  super(file) {
    this.file = file;
    this.fd = InternalFS.getFdForFile(file);
  }
  getAsyncId() {
    return this.fd;
  }
}

class FSReqCallback<ResultType = unknown> {
  constructor(bigint?: boolean) {}
  oncomplete: ((error: Error) => void) | ((error: null, result: ResultType) => void);
  context: ReadFileContext;
}

function callJSfunc(fn, req, ctx, ...args) {
  if (req instanceof FSReqCallback) {
    try {
      req.oncomplete?.(null, fn(...args));
    } catch (e) {
      req.oncomplete?.(e);
    }
  } else if (req === InternalFS.kUsePromises) {
    return new Promise((resolve, reject) => {
      try {
        resolve(fn(...args));
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return fn(...args);
  }
  return fn(...args);
}

export class InternalFS {
  static fdMap = new Map<number, PreloadFile<MountableFileSystem>>();
  static nextFD = 3;

  static FSReqCallback = FSReqCallback;
  static getFdForFile(path: PreloadFile<MountableFileSystem>): number {
    const fd = InternalFS.nextFD++;
    this.fdMap.set(fd, path);
    return fd;
  }

  static readonly kUsePromises: unique symbol = Symbol('usePromises');

  private static _open(
    path: StringOrBuffer,
    flags: number,
    mode: number,
  ): number | Promise<number> {
    console.log(arguments);
    let file = Kernel.fs.openSync(
      path as string,
      FileFlag.getFileFlag(
        {
          [constants.fs.O_RDONLY]: 'r' as const,
          [constants.fs.O_RDWR]: 'r+' as const,
        }[flags],
      ),
      mode,
    ) as PreloadFile<MountableFileSystem>;

    return InternalFS.getFdForFile(file);
  }

  static open(
    path: StringOrBuffer,
    flags: number,
    mode: number,
    req?: FSReqCallback<number> | typeof InternalFS.kUsePromises,
    ctx?: FSSyncContext,
  ): number | Promise<number> {
    return callJSfunc(InternalFS._open, req, ctx, path, flags, mode);
  }

  static openFileHandle(
    path: StringOrBuffer,
    flags: number,
    mode: number,
    req?: FSReqCallback<number> | typeof InternalFS.kUsePromises,
    ctx?: FSSyncContext,
  ): number | Promise<number> {
    return callJSfunc(InternalFS._open, req, ctx, path, flags, mode);
  }

  private static _read(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): number {
    console.log(arguments);
    let file = InternalFS.fdMap.get(fd);
    let buf = Buffer.from(buffer);
    let bytes = file.readSync(buf, 0, length, position);
    buf.copy(buffer, 0, 0, bytes);
    return bytes;
  }

  static read(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
    req?: FSReqCallback<number> | typeof InternalFS.kUsePromises,
    ctx?: FSSyncContext,
  ) {
    callJSfunc(InternalFS._read, req, ctx, fd, buffer, offset, length, position);
  }

  static _close(fd: number): void {
    if (InternalFS.fdMap.has(fd)) {
      InternalFS.fdMap.delete(fd);
    }
  }

  static close(
    fd: number,
    req?: FSReqCallback<void> | typeof InternalFS.kUsePromises,
    ctx?: FSSyncContext,
  ): void {
    callJSfunc(InternalFS._close, req, ctx, fd);
  }

  static statValues = new Float64Array([
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

  static _fstat(fd: number, useBigInt: false): Float64Array {
    if (fd !== undefined && InternalFS.fdMap.has(fd)) {
      let file = InternalFS.fdMap.get(fd);
      console.log(file);
      InternalFS.statValues[1] =
        (0xf000 & ((file.getStats().isDirectory() ? 0b0100 : 0b1000) << 12)) |
        (0x0fff & 0x1b7) /*no clue*/;
      InternalFS.statValues[8] = file.getStats().size;

      return InternalFS.statValues;
    }

    return InternalFS.statValues;
  }

  static fstat(
    fd: number,
    useBigInt: false,
    req?: FSReqCallback<Float64Array> | typeof InternalFS.kUsePromises,
    ctx?: FSSyncContext,
  ): Float64Array {
    return callJSfunc(InternalFS._fstat, req, ctx, fd, useBigInt);
  }

  static _lstat(path: string, useBigInt: false): Float64Array {
    let stats = Kernel.fs.statSync(path, true);
    InternalFS.statValues[1] =
      (0xf000 & ((stats.isDirectory() ? 0b0100 : 0b1000) << 12)) | (0x0fff & 0x1b7) /*no clue*/;
    InternalFS.statValues[8] = stats.size;

    return InternalFS.statValues;
  }

  static lstat(
    path: string,
    useBigInt: false,
    req?: FSReqCallback<Float64Array> | typeof InternalFS.kUsePromises,
    ctx?: FSSyncContext,
  ): Float64Array | Promise<Float64Array> {
    return callJSfunc(InternalFS._lstat, req, ctx, path, useBigInt);
  }
}

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
