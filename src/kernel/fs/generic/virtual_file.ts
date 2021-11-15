import Stats, { FileType } from '../core/stats';
import { ApiError, ErrorCode } from '../core/api_error';
import { SynchronousBaseFile } from '../core/file';
import { isReadable, isAppendable, isSynchronous, isWriteable } from '../core/file_flag';
import type { FileFlagString } from '../core/file_flag';
import type { CallbackOneArg, CallbackTwoArgs } from '../core/file_system';
import type { Process } from 'os/kernel/kernel/proc';
import { Buffer } from 'buffer';
// import { emptyBuffer } from '../core/util';

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
export default abstract class VirtualFile extends SynchronousBaseFile {
  protected _pos: number = 0;
  protected _path: string;
  protected _stat: Stats;
  protected _flag: FileFlagString;
  protected _dirty: boolean = false;

  // any file that has a class open is a file descriptor, so it has an attached process and id
  protected process: Process;
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
  constructor(
    _path: string = '/dev/null',
    _flag: FileFlagString = 'r',
    _stat?: Stats,
    fileType: FileType = FileType.VIRTUAL,
    // contents?: Buffer,
  ) {
    super();
    this._path = _path;
    this._flag = _flag;
    // this._buffer = contents ? contents : emptyBuffer();
    // Note: This invariant is *not* maintained once the file starts getting
    // modified.
    // Note: Only actually matters if file is readable, as writeable modes may
    // truncate/append to file.
    // if (this._stat.size !== this._buffer.length && isReadable(this._flag)) {
    //   throw new Error(
    //     `Invalid buffer: Buffer is ${this._buffer.length} long, yet Stats object specifies that file is ${this._stat.size} long.`,
    //   );
    // }
    this._stat = _stat ?? new Stats(fileType, 0);
  }

  /**
   * NONSTANDARD: Get the underlying buffer for this file. !!DO NOT MUTATE!! Will mess up dirty tracking.
   */
  public getBuffer(cb: CallbackTwoArgs<Buffer>): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  /**
   * NONSTANDARD: Get the underlying buffer for this file. !!DO NOT MUTATE!! Will mess up dirty tracking.
   */
  public getBufferSync(): Buffer {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  /**
   * NONSTANDARD: Get underlying stats for this file. !!DO NOT MUTATE!!
   */
  public getStats(): Stats {
    return this._stat;
  }

  public getFlag(): FileFlagString {
    return this._flag;
  }

  /**
   * Get the path to this file.
   * @return [String] The path to the file.
   */
  public getPath(): string {
    return this._path;
  }

  /**
   * Get the current file position.
   *
   * We emulate the following bug mentioned in the Node documentation:
   * > On Linux, positional writes don't work when the file is opened in append
   *   mode. The kernel ignores the position argument and always appends the data
   *   to the end of the file.
   * @return [Number] The current file position.
   */
  public getPos(): number {
    if (isAppendable(this._flag)) {
      return this._stat.size;
    }
    return this._pos;
  }

  /**
   * Advance the current file position by the indicated number of positions.
   * @param [Number] delta
   */
  public advancePos(delta: number): number {
    return (this._pos += delta);
  }

  /**
   * Set the file position.
   * @param [Number] newPos
   */
  public setPos(newPos: number): number {
    return (this._pos = newPos);
  }

  /**
   * Synchronous `stat`.
   */
  public statSync(): Stats {
    return Stats.clone(this._stat);
  }

  /**
   * Asynchronous truncate.
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public truncate(len: number, cb: CallbackOneArg): void {
    try {
      this.truncateSync(len);
      if (isSynchronous(this._flag) && !this.process.kernel.fs!.supportsSynch()) {
        this.sync(cb);
      }
      cb();
    } catch (e) {
      return cb(e);
    }
  }

  /**
   * Synchronous truncate.
   * @param [Number] len
   */
  public truncateSync(len: number): void {
    this._dirty = true;
    if (!isWriteable(this._flag)) {
      throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
    }
    this._stat.mtimeMs = Date.now();

    this.setBufferSync(this.resizeBuffer(this.getBufferSync(), len));

    // if (len > this._buffer.length) {
    //   const buf = Buffer.alloc(len - this._buffer.length, 0);
    //   // Write will set @_stat.size for us.
    //   this.writeSync(buf, 0, buf.length, this._buffer.length);
    //   if (isSynchronous(this._flag) && this._fs!.supportsSynch()) {
    //     this.syncSync();
    //   }
    //   return;
    // }
    // this._stat.size = len;
    // // Truncate buffer to 'len'.
    // const newBuff = Buffer.alloc(len);
    // this._buffer.copy(newBuff, 0, 0, len);
    // this._buffer = newBuff;
    if (isSynchronous(this._flag) && this.process.kernel.fs!.supportsSynch()) {
      this.syncSync();
    }
  }
  setBufferSync(arg0: Buffer) {
    throw new Error('Method not implemented.');
  }

  /**
   * Write buffer to the file.
   * Note that it is unsafe to use fs.writeSync multiple times on the same file
   * without waiting for the callback.
   * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
   *  the file.
   * @param [Number] offset Offset in the buffer to start reading data from.
   * @param [Number] length The amount of bytes to write to the file.
   * @param [Number] position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @return [Number]
   */
  public write(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    cb: CallbackTwoArgs<number>,
  ): void {
    if (!isWriteable(this._flag)) {
      throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
    }

    this._dirty = true;
    if (position === undefined || position === null) {
      position = this.getPos();
    }

    this.writeBuffer(buffer, offset, length, position, (err, len) => {
      if (err) {
        return cb(err);
      }
      this._stat.mtimeMs = Date.now();
      if (isSynchronous(this._flag)) {
        this.syncSync();
        return len;
      }
      this.setPos(position + len);
      cb(null, len);
    });
  }

  /**
   * Write buffer to the file.
   * Note that it is unsafe to use fs.writeSync multiple times on the same file
   * without waiting for the callback.
   * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
   *  the file.
   * @param [Number] offset Offset in the buffer to start reading data from.
   * @param [Number] length The amount of bytes to write to the file.
   * @param [Number] position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @return [Number]
   */
  public writeSync(buffer: Buffer, offset: number, length: number, position: number): number {
    if (!isWriteable(this._flag)) {
      throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
    }

    this._dirty = true;
    if (position === undefined || position === null) {
      position = this.getPos();
    }

    const len = this.writeBufferSync(buffer, offset, length, position);

    this._stat.mtimeMs = Date.now();
    if (isSynchronous(this._flag)) {
      this.syncSync();
      return len;
    }
    this.setPos(position + len);
    return len;
  }

  protected writeBuffer(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    cb: CallbackTwoArgs<number>,
  ): void {
    const endFp = position + length;
    this.getBuffer((err, currentBuffer) => {
      if (err) {
        cb(err);
      }

      if (endFp > currentBuffer.length) {
        currentBuffer = this.resizeBuffer(currentBuffer, endFp);
      }

      cb(null, buffer.copy(currentBuffer, position, offset, offset + length));
    });
  }

  protected writeBufferSync(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
  ): number {
    const endFp = position + length;
    let currentBuffer = this.getBufferSync();

    if (endFp > currentBuffer.length) {
      currentBuffer = this.resizeBuffer(currentBuffer, endFp);
    }

    return buffer.copy(currentBuffer, position, offset, offset + length);
  }

  protected resizeBuffer(buffer: Buffer, size: number): Buffer {
    this._stat.size = size;
    // Extend the buffer!
    const newBuff = Buffer.alloc(size);
    buffer.copy(newBuff);
    this.setBuffer(newBuff);
    return newBuff;
  }

  protected setBuffer(buffer: Buffer): void {
    throw new Error('setBuffer is not implemented');
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
   * @return [Number]
   */
  public readSync(buffer: Buffer, offset: number, length: number, position: number): number {
    if (!isReadable(this._flag)) {
      throw new ApiError(ErrorCode.EPERM, 'File not opened with a readable mode.');
    }
    if (position === undefined || position === null) {
      position = this.getPos();
    }

    // not sure we should do this here since this file not really care about its stats size
    // const endRead = position + length;
    // if (endRead > this._stat.size) {
    //   length = this._stat.size - position;
    // }

    const rv = this.readBufferSync(buffer, offset, length, position);

    this._stat.atimeMs = Date.now();
    this.advancePos(rv);
    return rv;
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
   * @return [Number]
   */
  public read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    cb: CallbackTwoArgs<number>,
  ): void {
    if (!isReadable(this._flag)) {
      throw new ApiError(ErrorCode.EPERM, 'File not opened with a readable mode.');
    }
    if (position === undefined || position === null) {
      position = this.getPos();
    }

    this.readBuffer(buffer, offset, length, position, (err, rv) => {
      if (err) {
        cb(err);
      }

      this._stat.atimeMs = Date.now();
      this.advancePos(rv);
      cb(null, rv);
    });
  }

  // reads to the buffer, the given offset, length, and position
  // if position is undefined or null, we use the files current position
  // to read from
  public readBufferSync(buffer: Buffer, offset: number, length: number, position: number): number {
    let currentBuffer = this.getBufferSync();
    let size = currentBuffer.length;

    const endRead = position + length;
    if (endRead > size) {
      length = size - position;
    }

    return currentBuffer.copy(buffer, offset, position, position + length);
  }

  // reads to the buffer, the given offset, length, and position
  // if position is undefined or null, we use the files current position
  // to read from
  public readBuffer(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    cb: CallbackTwoArgs<number>,
  ): void {
    this.getBuffer((err, currentBuffer) => {
      if (err) {
        cb(err);
      }

      let size = currentBuffer.length;

      const endRead = position + length;
      if (endRead > size) {
        length = size - position;
      }

      cb(null, currentBuffer.copy(buffer, offset, position, position + length));
    });
  }

  /**
   * Asynchronous `fchmod`.
   * @param [Number] mode
   */
  public chmodSync(mode: number): void {
    if (!this.process.kernel.fs.supportsProps()) {
      throw new ApiError(ErrorCode.ENOTSUP);
    }
    this._dirty = true;
    this._stat.chmod(mode);
    this.syncSync();
  }

  protected isDirty(): boolean {
    return this._dirty;
  }

  /**
   * Resets the dirty bit. Should only be called after a sync has completed successfully.
   */
  protected resetDirty() {
    this._dirty = false;
  }

  public async readString(): Promise<string> {
    return new Promise((res, rej) => {
      let buffer = Buffer.alloc(100);
      this.readBuffer(buffer, 0, length, 0, (err, readLength) => {
        if (err) {
          rej(err);
        }
        res(buffer.toString('utf8', 0, readLength));
      });
    });
  }

  public async writeString(str: string): Promise<number> {
    return new Promise((res, rej) => {
      let string = Buffer.from(str, 'utf8');
      this.writeBuffer(string, 0, length, null, (err, length) => {
        if (err) {
          rej(err);
        }
        res(length);
      });
    });
  }
}
