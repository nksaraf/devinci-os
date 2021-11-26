import { ApiError, ErrorCode } from './api_error';
import type Stats from './stats';

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
  writeSync(buffer: Uint8Array, offset: number, length: number, position: number | null): number;

  /**
   * **Core**: Read data from the file.
   * @param buffer The buffer that the data will be written to.
   * @param offset The offset within the buffer where writing will start.
   * @param length An integer specifying the number of bytes to read.
   * @param position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   */
  readSync(buffer: Uint8Array, offset: number, length: number, position: number): number;
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

export interface File {
  /**
   * **Core**: Get the current file position.
   */
  getPos(): number | undefined;
  /**
   * **Core**: Asynchronous `stat`.
   */
  stat(): Promise<Stats>;
  /**
   * **Core**: Synchronous `stat`.
   */
  statSync(): Stats;
  /**
   * **Core**: Asynchronous close.
   */
  close(): Promise<void>;
  /**
   * **Core**: Synchronous close.
   */
  closeSync(): void;
  /**
   * **Core**: Asynchronous truncate.
   */
  truncate(len: number): Promise<void>;
  /**
   * **Core**: Synchronous truncate.
   */
  truncateSync(len: number): void;
  /**
   * **Core**: Asynchronous sync.
   */
  sync(): Promise<void>;
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
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): Promise<number>;
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
  writeSync(buffer: Uint8Array, offset: number, length: number, position: number | null): number;
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
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): Promise<number>;
  /**
   * **Core**: Read data from the file.
   * @param buffer The buffer that the data will be written to.
   * @param offset The offset within the buffer where writing will start.
   * @param length An integer specifying the number of bytes to read.
   * @param position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   */
  readSync(buffer: Uint8Array, offset: number, length: number, position: number): number;
  /**
   * **Supplementary**: Asynchronous `datasync`.
   *
   * Default implementation maps to `sync`.
   */
  datasync(): Promise<void>;
  /**
   * **Supplementary**: Synchronous `datasync`.
   *
   * Default implementation maps to `syncSync`.
   */
  datasyncSync(): void;
  /**
   * **Optional**: Asynchronous `chown`.
   */
  chown(uid: number, gid: number): Promise<void>;
  /**
   * **Optional**: Synchronous `chown`.
   */
  chownSync(uid: number, gid: number): void;
  /**
   * **Optional**: Asynchronous `fchmod`.
   */
  chmod(mode: number): Promise<void>;
  /**
   * **Optional**: Synchronous `fchmod`.
   */
  chmodSync(mode: number): void;
  /**
   * **Optional**: Change the file timestamps of the file.
   */
  utimes(atime: Date, mtime: Date): Promise<void>;
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
  public async sync(): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public syncSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async datasync(): Promise<void> {
    this.sync();
  }
  public datasyncSync(): void {
    return this.syncSync();
  }
  public async chown(uid: number, gid: number): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public chownSync(uid: number, gid: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async chmod(mode: number): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public chmodSync(mode: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async utimes(atime: Date, mtime: Date): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public utimesSync(atime: Date, mtime: Date): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}

export abstract class SynchronousBaseFile extends BaseFile {
  public supportsSynch(): boolean {
    return true;
  }

  async stat(): Promise<Stats> {
    return this.statSync();
  }

  statSync(): Stats {
    throw new Error('Method not implemented.');
  }

  async truncate(len: number): Promise<void> {
    this.truncateSync(len);
  }

  truncateSync(len: number): void {
    throw new Error('Method not implemented.');
  }

  async write(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<number> {
    return this.writeSync(buffer, offset, length, position);
  }

  writeSync(buffer: Uint8Array, offset: number, length: number, position: number): number {
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
  public async read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<number> {
    return this.readSync(buffer, offset, length, position);
  }

  public readSync(buffer: Uint8Array, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }

  public async datasync(): Promise<void> {
    this.sync();
  }

  public datasyncSync(): void {
    return this.syncSync();
  }

  public async chown(uid: number, gid: number): Promise<void> {
    return this.chownSync(uid, gid);
  }

  public chownSync(uid: number, gid: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public async chmod(mode: number): Promise<void> {
    this.chmodSync(mode);
  }

  public chmodSync(mode: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public async utimes(atime: Date, mtime: Date): Promise<void> {
    this.utimesSync(atime, mtime);
  }

  public utimesSync(atime: Date, mtime: Date): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  /**
   * **Core**: Asynchronous sync. Must be implemented by subclasses of this
   * class.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public async sync(): Promise<void> {
    this.syncSync();
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
  public async close(): Promise<void> {
    this.closeSync();
  }

  /**
   * **Core**: Synchronous close.
   */
  public closeSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}
