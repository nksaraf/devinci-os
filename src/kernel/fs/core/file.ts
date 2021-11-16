import { ApiError, ErrorCode } from './api_error';
import type Stats from './stats';
import type {
  CallbackTwoArgs,
  CallbackOneArg,
  CallbackThreeArgs as CallbackThreeArgs,
} from './file_system';
import type * as fsTypes from 'wicg-file-system-access';

export interface SyncFile {
  /**
   * **Core**: Get the current file position.
   */
  getPos(): number | undefined;

  statSync(): Stats;

  closeSync(): void;

  /**
   * **Core**: Synchronous truncate.
   */
  truncateSync(len: number): void;

  /**
   * **Core**: Synchronous sync.
   */
  syncSync(): void;

  /**
   * **Core**: Write buffer to the file.
   * Note that it is unsafe to use fs.writeSync multiple times on the same file
   * without waiting for it to return.
   * @param buffer Buffer containing the data to write to
   *  the file.
   * @param offset Offset in the buffer to start reading data from.
   * @param length The amount of bytes to write to the file.
   * @param position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   */
  writeSync(buffer: Buffer, offset: number, length: number, position: number | null): number;

  /**
   * **Core**: Read data from the file.
   * @param buffer The buffer that the data will be written to.
   * @param offset The offset within the buffer where writing will start.
   * @param length An integer specifying the number of bytes to read.
   * @param position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   */
  readSync(buffer: Buffer, offset: number, length: number, position: number): number;
  /**
   * **Supplementary**: Synchronous `datasync`.
   *
   * Default implementation maps to `syncSync`.
   */
  datasyncSync(): void;
  /**
   * **Optional**: Synchronous `chown`.
   */
  chownSync(uid: number, gid: number): void;
  /**
   * **Optional**: Synchronous `fchmod`.
   */
  chmodSync(mode: number): void;
  /**
   * **Optional**: Change the file timestamps of the file.
   */
  utimesSync(atime: Date, mtime: Date): void;
}

class WritableFileStream extends WritableStream implements FileSystemWritableFileStream {
  file
  write(data: FileSystemWriteChunkType): Promise<void> {
    throw new Error('Method not implemented.');
  }
  seek(position: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
  truncate(size: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

class FileHandle implements FileSystemFileHandle {
  kind = 'file' as const;
  async getData(): Promise<BlobPart[]> {
    throw new Error('Method not implemented.');
  }
  async getFile(): Promise<globalThis.File> {
    return new File(await this.getData(), 'file.txt');
  }
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream> {
    return new WritableStream({
      write(chunk: Uint8Array): void {

      },
      close(): void {
      }
    });
  }
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState> {
    throw new Error('Method not implemented.');
  }
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState> {
    throw new Error('Method not implemented.');
  }
  get isFile(): true;
  get isDirectory(): false;
  get lastModified(): Date;
}

export interface File {
  /**
   * **Core**: Get the current file position.
   */
  getPos(): number | undefined;
  /**
   * **Core**: Asynchronous `stat`.
   */
  stat(cb: CallbackTwoArgs<Stats>): void;
  /**
   * **Core**: Synchronous `stat`.
   */
  statSync(): Stats;
  /**
   * **Core**: Asynchronous close.
   */
  close(cb: CallbackTwoArgs<Stats>): void;
  /**
   * **Core**: Synchronous close.
   */
  closeSync(): void;
  /**
   * **Core**: Asynchronous truncate.
   */
  truncate(len: number, cb: CallbackOneArg): void;
  /**
   * **Core**: Synchronous truncate.
   */
  truncateSync(len: number): void;
  /**
   * **Core**: Asynchronous sync.
   */
  sync(cb: CallbackOneArg): void;
  /**
   * **Core**: Synchronous sync.
   */
  syncSync(): void;
  /**
   * **Core**: Write buffer to the file.
   * Note that it is unsafe to use fs.write multiple times on the same file
   * without waiting for the callback.
   * @param buffer Buffer containing the data to write to
   *  the file.
   * @param offset Offset in the buffer to start reading data from.
   * @param length The amount of bytes to write to the file.
   * @param position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @param cb The number specifies the number of bytes written into the file.
   */
  write(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number | null,
    cb: CallbackThreeArgs<number, Buffer>,
  ): void;
  /**
   * **Core**: Write buffer to the file.
   * Note that it is unsafe to use fs.writeSync multiple times on the same file
   * without waiting for it to return.
   * @param buffer Buffer containing the data to write to
   *  the file.
   * @param offset Offset in the buffer to start reading data from.
   * @param length The amount of bytes to write to the file.
   * @param position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   */
  writeSync(buffer: Buffer, offset: number, length: number, position: number | null): number;
  /**
   * **Core**: Read data from the file.
   * @param buffer The buffer that the data will be
   *   written to.
   * @param offset The offset within the buffer where writing will
   *   start.
   * @param length An integer specifying the number of bytes to read.
   * @param position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   * @param cb The number is the number of bytes read
   */
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number | null,
    cb: CallbackThreeArgs<number, Buffer>,
  ): void;
  /**
   * **Core**: Read data from the file.
   * @param buffer The buffer that the data will be written to.
   * @param offset The offset within the buffer where writing will start.
   * @param length An integer specifying the number of bytes to read.
   * @param position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   */
  readSync(buffer: Buffer, offset: number, length: number, position: number): number;
  /**
   * **Supplementary**: Asynchronous `datasync`.
   *
   * Default implementation maps to `sync`.
   */
  datasync(cb: CallbackOneArg): void;
  /**
   * **Supplementary**: Synchronous `datasync`.
   *
   * Default implementation maps to `syncSync`.
   */
  datasyncSync(): void;
  /**
   * **Optional**: Asynchronous `chown`.
   */
  chown(uid: number, gid: number, cb: CallbackOneArg): void;
  /**
   * **Optional**: Synchronous `chown`.
   */
  chownSync(uid: number, gid: number): void;
  /**
   * **Optional**: Asynchronous `fchmod`.
   */
  chmod(mode: number, cb: CallbackOneArg): void;
  /**
   * **Optional**: Synchronous `fchmod`.
   */
  chmodSync(mode: number): void;
  /**
   * **Optional**: Change the file timestamps of the file.
   */
  utimes(atime: Date, mtime: Date, cb: CallbackOneArg): void;
  /**
   * **Optional**: Change the file timestamps of the file.
   */
  utimesSync(atime: Date, mtime: Date): void;
}

/**
 * Base class that contains shared implementations of functions for the file
 * object.
 */
export abstract class BaseFile {
  constructor() {}
  public sync(cb: CallbackOneArg): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public syncSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public datasync(cb: CallbackOneArg): void {
    this.sync(cb);
  }
  public datasyncSync(): void {
    return this.syncSync();
  }
  public chown(uid: number, gid: number, cb: CallbackOneArg): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public chownSync(uid: number, gid: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public chmod(mode: number, cb: CallbackOneArg): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public chmodSync(mode: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public utimes(atime: Date, mtime: Date, cb: CallbackOneArg): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public utimesSync(atime: Date, mtime: Date): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}

export abstract class SynchronousBaseFile extends BaseFile {
  public supportsSynch(): boolean {
    return true;
  }

  stat(cb: CallbackTwoArgs<Stats>): void {
    try {
      cb(null, this.statSync());
    } catch (e) {
      cb(e);
    }
  }

  statSync(): Stats {
    throw new Error('Method not implemented.');
  }

  truncate(len: number, cb: CallbackOneArg): void {
    try {
      this.truncateSync(len);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }

  truncateSync(len: number): void {
    throw new Error('Method not implemented.');
  }

  write(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    cb: CallbackThreeArgs<number, Buffer>,
  ): void {
    try {
      cb(null, this.writeSync(buffer, offset, length, position));
    } catch (e) {
      cb(e);
    }
  }

  writeSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }

  /**
   * Read data from the file.
   * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
   *   written to.
   * @param [Number] offset The offset within the buffer where writing will
   *   start.
   * @param [Number] length An integer specifying the number of bytes to read.
   * @param [Number] position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)] cb The
   *   number is the number of bytes read
   */
  public read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    cb: CallbackThreeArgs<number, Buffer>,
  ): void {
    try {
      cb(null, this.readSync(buffer, offset, length, position), buffer);
    } catch (e) {
      cb(e);
    }
  }

  public readSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }

  public datasync(cb: CallbackOneArg): void {
    this.sync(cb);
  }

  public datasyncSync(): void {
    return this.syncSync();
  }

  public chown(uid: number, gid: number, cb: CallbackOneArg): void {
    try {
      this.chownSync(uid, gid);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }

  public chownSync(uid: number, gid: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public chmod(mode: number, cb: CallbackOneArg): void {
    try {
      this.chmodSync(mode);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }

  public chmodSync(mode: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public utimes(atime: Date, mtime: Date, cb: CallbackOneArg): void {
    try {
      this.utimesSync(atime, mtime);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }
  public utimesSync(atime: Date, mtime: Date): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  /**
   * **Core**: Asynchronous sync. Must be implemented by subclasses of this
   * class.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public sync(cb: CallbackOneArg): void {
    try {
      this.syncSync();
      cb();
    } catch (e) {
      cb(e);
    }
  }

  /**
   * **Core**: Synchronous sync.
   */
  public syncSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  /**
   * **Core**: Asynchronous close. Must be implemented by subclasses of this
   * class.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public close(cb: CallbackOneArg): void {
    try {
      this.closeSync();
      cb();
    } catch (e) {
      cb(e);
    }
  }

  /**
   * **Core**: Synchronous close.
   */
  public closeSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}
