import type { File } from '../core/file';
import type { IFileSystem, CallbackOneArg } from '../core/file_system';
import type Stats from '../core/stats';
import type { FileFlagString } from '../core/file_flag';
import { isReadable } from '../core/file_flag';
import { emptyBuffer } from '../core/util';
import VirtualFile from './virtual_file';

/**
 * An implementation of the File interface that operates on a file that is
 * completely in-memory. PreloadFiles are backed by a Buffer.
 *
 * This is also an abstract class, as it lacks an implementation of 'sync' and
 * 'close'. Each filesystem that wishes to use this file representation must
 * extend this class and implement those two methods.
 * @todo 'close' lever that disables functionality once closed.
 *
 * this handles the tracking of the stats object passed in
 */
export default abstract class PreloadFile<T extends IFileSystem>
  extends VirtualFile
  implements File
{
  protected _fs: T;
  private _buffer: Buffer;
  /**
   * Creates a file with the given path and, optionally, the given contents. Note
   * that, if contents is specified, it will be mutated by the file!
   * @param _fs The file system that created the file.
   * @param _path
   * @param _mode The mode that the file was opened using.
   *   Dictates permissions and where the file pointer starts.
   * @param _stat The stats object for the given file.
   *   PreloadFile will mutate this object. Note that this object must contain
   *   the appropriate mode that the file was opened as.
   * @param contents A buffer containing the entire
   *   contents of the file. PreloadFile will mutate this buffer. If not
   *   specified, we assume it is a new file.
   */
  constructor(_fs: T, _path: string, _flag: FileFlagString, _stat: Stats, contents?: Buffer) {
    super(_path, _flag, _stat);
    this._fs = _fs;
    this._buffer = contents ? contents : emptyBuffer();
    // Note: This invariant is *not* maintained once the file starts getting
    // modified.
    // Note: Only actually matters if file is readable, as writeable modes may
    // truncate/append to file.
    if (this._stat.size !== this._buffer.length && isReadable(this._flag)) {
      throw new Error(
        `Invalid buffer: Buffer is ${this._buffer.length} long, yet Stats object specifies that file is ${this._stat.size} long.`,
      );
    }
  }

  /**
   * NONSTANDARD: Get the underlying buffer for this file. !!DO NOT MUTATE!! Will mess up dirty tracking.
   */
  public getBuffer(): Buffer {
    return this._buffer;
  }

  public getBufferSync(): Buffer {
    return this._buffer;
  }

  /**
   * NONSTANDARD: Get the underlying buffer for this file. !!DO NOT MUTATE!! Will mess up dirty tracking.
   */
  public setBuffer(buffer: Buffer): void {
    this._buffer = buffer;
  }
}

/**
 * File class for the InMemory and XHR file systems.
 * Doesn't sync to anything, so it works nicely for memory-only files.
 */
export class NoSyncFile<T extends IFileSystem> extends PreloadFile<T> implements File {
  constructor(_fs: T, _path: string, _flag: FileFlagString, _stat: Stats, contents?: Buffer) {
    super(_fs, _path, _flag, _stat, contents);
  }
  /**
   * Asynchronous sync. Doesn't do anything, simply calls the cb.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public sync(cb: CallbackOneArg): void {
    cb();
  }
  /**
   * Synchronous sync. Doesn't do anything.
   */
  public syncSync(): void {
    // NOP.
  }
  /**
   * Asynchronous close. Doesn't do anything, simply calls the cb.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public close(cb: CallbackOneArg): void {
    cb();
  }
  /**
   * Synchronous close. Doesn't do anything.
   */
  public closeSync(): void {
    // NOP.
  }
}
