class FSReqCallback<ResultType = unknown> {
  constructor(bigint?: boolean) {}
  oncomplete: ((error: Error) => void) | ((error: null, result: ResultType) => void);
  context: ReadFileContext;
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

type Buffer = Uint8Array;
type Stream = object;
type StringOrBuffer = string | Buffer;

const kUsePromises: unique symbol = Symbol('kUsePromises');

class FileHandle {
  constructor(fd: number, offset: number, length: number) {}
  fd: number;
  getAsyncId(): number {}
  close(): Promise<void> {}
  onread: () => void;
  stream: Stream;
}

class StatWatcher {
  constructor(useBigint: boolean) {}
  initialized: boolean;
  start(path: string, interval: number): number {}
  getAsyncId(): number {}
  close(): void {}
  ref(): void {}
  unref(): void {}
  onchange: (status: number, eventType: string, filename: string | Buffer) => {};
}

export function access(path: StringOrBuffer, mode: number, req: FSReqCallback): void;
export function access(
  path: StringOrBuffer,
  mode: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function access(
  path: StringOrBuffer,
  mode: number,
  usePromises: typeof kUsePromises,
): Promise<void> {}

export function chmod(path: string, mode: number, req: FSReqCallback): void;
export function chmod(path: string, mode: number, req: undefined, ctx: FSSyncContext): void;
export function chmod(
  path: string,
  mode: number,
  usePromises: typeof kUsePromises,
): Promise<void> {}

export function chown(path: string, uid: number, gid: number, req: FSReqCallback): void;
export function chown(
  path: string,
  uid: number,
  gid: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function chown(
  path: string,
  uid: number,
  gid: number,
  usePromises: typeof kUsePromises,
): Promise<void> {}

export function close(fd: number, req: FSReqCallback): void;
export function close(fd: number, req: undefined, ctx: FSSyncContext): void {}

export function copyFile(
  src: StringOrBuffer,
  dest: StringOrBuffer,
  mode: number,
  req: FSReqCallback,
): void;
export function copyFile(
  src: StringOrBuffer,
  dest: StringOrBuffer,
  mode: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function copyFile(
  src: StringOrBuffer,
  dest: StringOrBuffer,
  mode: number,
  usePromises: typeof kUsePromises,
): Promise<void> {}

export function fchmod(fd: number, mode: number, req: FSReqCallback): void;
export function fchmod(fd: number, mode: number, req: undefined, ctx: FSSyncContext): void;
export function fchmod(fd: number, mode: number, usePromises: typeof kUsePromises): Promise<void> {}

export function fchown(fd: number, uid: number, gid: number, req: FSReqCallback): void;
export function fchown(
  fd: number,
  uid: number,
  gid: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function fchown(
  fd: number,
  uid: number,
  gid: number,
  usePromises: typeof kUsePromises,
): Promise<void> {}

export function fdatasync(fd: number, req: FSReqCallback): void;
export function fdatasync(fd: number, req: undefined, ctx: FSSyncContext): void;
export function fdatasync(fd: number, usePromises: typeof kUsePromises): Promise<void> {}

export function fstat(
  fd: number,
  useBigint: boolean,
  req: FSReqCallback<Float64Array | BigUint64Array>,
): void;
export function fstat(fd: number, useBigint: true, req: FSReqCallback<BigUint64Array>): void;
export function fstat(fd: number, useBigint: false, req: FSReqCallback<Float64Array>): void;
export function fstat(
  fd: number,
  useBigint: boolean,
  req: undefined,
  ctx: FSSyncContext,
): Float64Array | BigUint64Array;
export function fstat(
  fd: number,
  useBigint: true,
  req: undefined,
  ctx: FSSyncContext,
): BigUint64Array;
export function fstat(
  fd: number,
  useBigint: false,
  req: undefined,
  ctx: FSSyncContext,
): Float64Array;
export function fstat(
  fd: number,
  useBigint: boolean,
  usePromises: typeof kUsePromises,
): Promise<Float64Array | BigUint64Array>;
export function fstat(
  fd: number,
  useBigint: true,
  usePromises: typeof kUsePromises,
): Promise<BigUint64Array>;
export function fstat(
  fd: number,
  useBigint: false,
  usePromises: typeof kUsePromises,
): Promise<Float64Array> {}

export function fsync(fd: number, req: FSReqCallback): void;
export function fsync(fd: number, req: undefined, ctx: FSSyncContext): void;
export function fsync(fd: number, usePromises: typeof kUsePromises): Promise<void> {}

export function ftruncate(fd: number, len: number, req: FSReqCallback): void;
export function ftruncate(fd: number, len: number, req: undefined, ctx: FSSyncContext): void;
export function ftruncate(
  fd: number,
  len: number,
  usePromises: typeof kUsePromises,
): Promise<void> {}

export function futimes(fd: number, atime: number, mtime: number, req: FSReqCallback): void;
export function futimes(
  fd: number,
  atime: number,
  mtime: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function futimes(
  fd: number,
  atime: number,
  mtime: number,
  usePromises: typeof kUsePromises,
): Promise<void> {}

export function internalModuleReadJSON(path: string): [] | [string, boolean] {}
export function internalModuleStat(path: string): number {}

export function lchown(path: string, uid: number, gid: number, req: FSReqCallback): void;
export function lchown(
  path: string,
  uid: number,
  gid: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function lchown(
  path: string,
  uid: number,
  gid: number,
  usePromises: typeof kUsePromises,
): Promise<void> { }

export function link(existingPath: string, newPath: string, req: FSReqCallback): void;
export function link(
  existingPath: string,
  newPath: string,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function link(
  existingPath: string,
  newPath: string,
  usePromises: typeof kUsePromises,
): Promise<void> { }

export function lstat(
  path: StringOrBuffer,
  useBigint: boolean,
  req: FSReqCallback<Float64Array | BigUint64Array>,
): void;
export function lstat(
  path: StringOrBuffer,
  useBigint: true,
  req: FSReqCallback<BigUint64Array>,
): void;
export function lstat(
  path: StringOrBuffer,
  useBigint: false,
  req: FSReqCallback<Float64Array>,
): void;
export function lstat(
  path: StringOrBuffer,
  useBigint: boolean,
  req: undefined,
  ctx: FSSyncContext,
): Float64Array | BigUint64Array;
export function lstat(
  path: StringOrBuffer,
  useBigint: true,
  req: undefined,
  ctx: FSSyncContext,
): BigUint64Array;
export function lstat(
  path: StringOrBuffer,
  useBigint: false,
  req: undefined,
  ctx: FSSyncContext,
): Float64Array;
export function lstat(
  path: StringOrBuffer,
  useBigint: boolean,
  usePromises: typeof kUsePromises,
): Promise<Float64Array | BigUint64Array>;
export function lstat(
  path: StringOrBuffer,
  useBigint: true,
  usePromises: typeof kUsePromises,
): Promise<BigUint64Array>;
export function lstat(
  path: StringOrBuffer,
  useBigint: false,
  usePromises: typeof kUsePromises,
): Promise<Float64Array> { }

export function lutimes(path: string, atime: number, mtime: number, req: FSReqCallback): void;
export function lutimes(
  path: string,
  atime: number,
  mtime: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function lutimes(
  path: string,
  atime: number,
  mtime: number,
  usePromises: typeof kUsePromises,
): Promise<void> { }

export function mkdtemp(prefix: string, encoding: unknown, req: FSReqCallback<string>): void;
export function mkdtemp(
  prefix: string,
  encoding: unknown,
  req: undefined,
  ctx: FSSyncContext,
): string;
export function mkdtemp(
  prefix: string,
  encoding: unknown,
  usePromises: typeof kUsePromises,
): Promise<string> { }

export function mkdir(
  path: string,
  mode: number,
  recursive: boolean,
  req: FSReqCallback<void | string>,
): void;
export function mkdir(
  path: string,
  mode: number,
  recursive: true,
  req: FSReqCallback<string>,
): void;
export function mkdir(path: string, mode: number, recursive: false, req: FSReqCallback<void>): void;
export function mkdir(
  path: string,
  mode: number,
  recursive: boolean,
  req: undefined,
  ctx: FSSyncContext,
): void | string;
export function mkdir(
  path: string,
  mode: number,
  recursive: true,
  req: undefined,
  ctx: FSSyncContext,
): string;
export function mkdir(
  path: string,
  mode: number,
  recursive: false,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function mkdir(
  path: string,
  mode: number,
  recursive: boolean,
  usePromises: typeof kUsePromises,
): Promise<void | string>;
export function mkdir(
  path: string,
  mode: number,
  recursive: true,
  usePromises: typeof kUsePromises,
): Promise<string>;
export function mkdir(
  path: string,
  mode: number,
  recursive: false,
  usePromises: typeof kUsePromises,
): Promise<void> { }

export function open(
  path: StringOrBuffer,
  flags: number,
  mode: number,
  req: FSReqCallback<number>,
): void;
export function open(
  path: StringOrBuffer,
  flags: number,
  mode: number,
  req: undefined,
  ctx: FSSyncContext,
): number { }

export function openFileHandle(
  path: StringOrBuffer,
  flags: number,
  mode: number,
  usePromises: typeof kUsePromises,
): Promise<FileHandle>;

export function read(
  fd: number,
  buffer: ArrayBufferView,
  offset: number,
  length: number,
  position: number,
  req: FSReqCallback<number>,
): void;
export function read(
  fd: number,
  buffer: ArrayBufferView,
  offset: number,
  length: number,
  position: number,
  req: undefined,
  ctx: FSSyncContext,
): number;
export function read(
  fd: number,
  buffer: ArrayBufferView,
  offset: number,
  length: number,
  position: number,
  usePromises: typeof kUsePromises,
): Promise<number>;

export function readBuffers(
  fd: number,
  buffers: ArrayBufferView[],
  position: number,
  req: FSReqCallback<number>,
): void;
export function readBuffers(
  fd: number,
  buffers: ArrayBufferView[],
  position: number,
  req: undefined,
  ctx: FSSyncContext,
): number;
export function readBuffers(
  fd: number,
  buffers: ArrayBufferView[],
  position: number,
  usePromises: typeof kUsePromises,
): Promise<number>;

export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: boolean,
  req: FSReqCallback<string[] | [string[], number[]]>,
): void;
export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: true,
  req: FSReqCallback<[string[], number[]]>,
): void;
export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: false,
  req: FSReqCallback<string[]>,
): void;
export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: boolean,
  req: undefined,
  ctx: FSSyncContext,
): string[] | [string[], number[]];
export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: true,
  req: undefined,
  ctx: FSSyncContext,
): [string[], number[]];
export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: false,
  req: undefined,
  ctx: FSSyncContext,
): string[];
export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: boolean,
  usePromises: typeof kUsePromises,
): Promise<string[] | [string[], number[]]>;
export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: true,
  usePromises: typeof kUsePromises,
): Promise<[string[], number[]]>;
export function readdir(
  path: StringOrBuffer,
  encoding: unknown,
  withFileTypes: false,
  usePromises: typeof kUsePromises,
): Promise<string[]>;

export function readlink(
  path: StringOrBuffer,
  encoding: unknown,
  req: FSReqCallback<string | Buffer>,
): void;
export function readlink(
  path: StringOrBuffer,
  encoding: unknown,
  req: undefined,
  ctx: FSSyncContext,
): string | Buffer;
export function readlink(
  path: StringOrBuffer,
  encoding: unknown,
  usePromises: typeof kUsePromises,
): Promise<string | Buffer>;

export function realpath(
  path: StringOrBuffer,
  encoding: unknown,
  req: FSReqCallback<string | Buffer>,
): void;
export function realpath(
  path: StringOrBuffer,
  encoding: unknown,
  req: undefined,
  ctx: FSSyncContext,
): string | Buffer;
export function realpath(
  path: StringOrBuffer,
  encoding: unknown,
  usePromises: typeof kUsePromises,
): Promise<string | Buffer>;

export function rename(oldPath: string, newPath: string, req: FSReqCallback): void;
export function rename(oldPath: string, newPath: string, req: undefined, ctx: FSSyncContext): void;
export function rename(
  oldPath: string,
  newPath: string,
  usePromises: typeof kUsePromises,
): Promise<void>;

export function rmdir(path: string, req: FSReqCallback): void;
export function rmdir(path: string, req: undefined, ctx: FSSyncContext): void;
export function rmdir(path: string, usePromises: typeof kUsePromises): Promise<void>;

export function stat(
  path: StringOrBuffer,
  useBigint: boolean,
  req: FSReqCallback<Float64Array | BigUint64Array>,
): void;
export function stat(
  path: StringOrBuffer,
  useBigint: true,
  req: FSReqCallback<BigUint64Array>,
): void;
export function stat(
  path: StringOrBuffer,
  useBigint: false,
  req: FSReqCallback<Float64Array>,
): void;
export function stat(
  path: StringOrBuffer,
  useBigint: boolean,
  req: undefined,
  ctx: FSSyncContext,
): Float64Array | BigUint64Array;
export function stat(
  path: StringOrBuffer,
  useBigint: true,
  req: undefined,
  ctx: FSSyncContext,
): BigUint64Array;
export function stat(
  path: StringOrBuffer,
  useBigint: false,
  req: undefined,
  ctx: FSSyncContext,
): Float64Array;
export function stat(
  path: StringOrBuffer,
  useBigint: boolean,
  usePromises: typeof kUsePromises,
): Promise<Float64Array | BigUint64Array>;
export function stat(
  path: StringOrBuffer,
  useBigint: true,
  usePromises: typeof kUsePromises,
): Promise<BigUint64Array>;
export function stat(
  path: StringOrBuffer,
  useBigint: false,
  usePromises: typeof kUsePromises,
): Promise<Float64Array>;

export function symlink(
  target: StringOrBuffer,
  path: StringOrBuffer,
  type: number,
  req: FSReqCallback,
): void;
export function symlink(
  target: StringOrBuffer,
  path: StringOrBuffer,
  type: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function symlink(
  target: StringOrBuffer,
  path: StringOrBuffer,
  type: number,
  usePromises: typeof kUsePromises,
): Promise<void>;

export function unlink(path: string, req: FSReqCallback): void;
export function unlink(path: string, req: undefined, ctx: FSSyncContext): void;
export function unlink(path: string, usePromises: typeof kUsePromises): Promise<void>;

export function utimes(path: string, atime: number, mtime: number, req: FSReqCallback): void;
export function utimes(
  path: string,
  atime: number,
  mtime: number,
  req: undefined,
  ctx: FSSyncContext,
): void;
export function utimes(
  path: string,
  atime: number,
  mtime: number,
  usePromises: typeof kUsePromises,
): Promise<void>;

export function writeBuffer(
  fd: number,
  buffer: ArrayBufferView,
  offset: number,
  length: number,
  position: number | null,
  req: FSReqCallback<number>,
): void;
export function writeBuffer(
  fd: number,
  buffer: ArrayBufferView,
  offset: number,
  length: number,
  position: number | null,
  req: undefined,
  ctx: FSSyncContext,
): number;
export function writeBuffer(
  fd: number,
  buffer: ArrayBufferView,
  offset: number,
  length: number,
  position: number | null,
  usePromises: typeof kUsePromises,
): Promise<number> {
  throw new Error('not implemented');
}

export function writeBuffers(
  fd: number,
  buffers: ArrayBufferView[],
  position: number,
  req: FSReqCallback<number>,
): void;
export function writeBuffers(
  fd: number,
  buffers: ArrayBufferView[],
  position: number,
  req: undefined,
  ctx: FSSyncContext,
): number;
export function writeBuffers(
  fd: number,
  buffers: ArrayBufferView[],
  position: number,
  usePromises: typeof kUsePromises,
): Promise<number> {
  throw new Error('not implemented');
}

export function writeString(
  fd: number,
  value: string,
  pos: unknown,
  encoding: unknown,
  req: FSReqCallback<number>,
): void;
export function writeString(
  fd: number,
  value: string,
  pos: unknown,
  encoding: unknown,
  req: undefined,
  ctx: FSSyncContext,
): number;
export function writeString(
  fd: number,
  value: string,
  pos: unknown,
  encoding: unknown,
  usePromises: typeof kUsePromises,
): Promise<number> {}

export type InternalFS = {
  FSReqCallback: typeof InternalFSBinding.FSReqCallback;

  FileHandle: typeof InternalFSBinding.FileHandle;

  kUsePromises: typeof InternalFSBinding.kUsePromises;

  statValues: Float64Array;
  bigintStatValues: BigUint64Array;

  kFsStatsFieldsNumber: number;
  StatWatcher: typeof InternalFSBinding.StatWatcher;

  access: typeof InternalFSBinding.access;
  chmod: typeof InternalFSBinding.chmod;
  chown: typeof InternalFSBinding.chown;
  close: typeof InternalFSBinding.close;
  copyFile: typeof InternalFSBinding.copyFile;
  fchmod: typeof InternalFSBinding.fchmod;
  fchown: typeof InternalFSBinding.fchown;
  fdatasync: typeof InternalFSBinding.fdatasync;
  fstat: typeof InternalFSBinding.fstat;
  fsync: typeof InternalFSBinding.fsync;
  ftruncate: typeof InternalFSBinding.ftruncate;
  futimes: typeof InternalFSBinding.futimes;
  internalModuleReadJSON: typeof InternalFSBinding.internalModuleReadJSON;
  internalModuleStat: typeof InternalFSBinding.internalModuleStat;
  lchown: typeof InternalFSBinding.lchown;
  link: typeof InternalFSBinding.link;
  lstat: typeof InternalFSBinding.lstat;
  lutimes: typeof InternalFSBinding.lutimes;
  mkdtemp: typeof InternalFSBinding.mkdtemp;
  mkdir: typeof InternalFSBinding.mkdir;
  open: typeof InternalFSBinding.open;
  openFileHandle: typeof InternalFSBinding.openFileHandle;
  read: typeof InternalFSBinding.read;
  readBuffers: typeof InternalFSBinding.readBuffers;
  readdir: typeof InternalFSBinding.readdir;
  readlink: typeof InternalFSBinding.readlink;
  realpath: typeof InternalFSBinding.realpath;
  rename: typeof InternalFSBinding.rename;
  rmdir: typeof InternalFSBinding.rmdir;
  stat: typeof InternalFSBinding.stat;
  symlink: typeof InternalFSBinding.symlink;
  unlink: typeof InternalFSBinding.unlink;
  utimes: typeof InternalFSBinding.utimes;
  writeBuffer: typeof InternalFSBinding.writeBuffer;
  writeBuffers: typeof InternalFSBinding.writeBuffers;
  writeString: typeof InternalFSBinding.writeString;
};

export const internalFS: InternalFS = {
  statValues: Float64Array,
  bigintStatValues: BigUint64Array,
  kFsStatsFieldsNumber: number,

  FSReqCallback,
  FileHandle,
  kUsePromises,
  StatWatcher,
  access,
  chmod,
  chown,
  close,
  copyFile,
  fchmod,
  fchown,
  fdatasync,
  fstat,
  fsync,
  ftruncate,
  futimes,
  internalModuleReadJSON,
  internalModuleStat,
  lchown,
  link,
  lstat,
  lutimes,
  mkdtemp,
  mkdir,
  open,
  openFileHandle,
  read,
  readBuffers,
  readdir,
  readlink,
  realpath,
  rename,
  rmdir,
  stat,
  symlink,
  unlink,
  utimes,
  writeBuffer,
  writeBuffers,
  writeString,
};
