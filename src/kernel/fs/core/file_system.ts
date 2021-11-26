import { ApiError, ErrorCode } from './api_error';
import type Stats from './stats';
import type { File } from './file';
import type { FileFlagString } from './file_flag';
import {
  pathExistsAction,
  pathNotExistsAction as getActionTypeIfNotExists,
  ActionType,
} from './file_flag';
import * as path from 'path';
import { mkdirpSync } from './util';
import { Buffer } from 'buffer';
// import wasmUrl from 'asc:./fs.asm';

// WebAssembly.instantiateStreaming(fetch(wasmUrl), {}).then(({ instance }) =>
//   console.log(instance.exports.add(40, 2)),
// );

/**
 * Interface for a filesystem. **All** BrowserFS FileSystems should implement
 * this interface.
 *
 * Below, we denote each API method as **Core**, **Supplemental**, or
 * **Optional**.
 *
 * ### Core Methods
 *
 * **Core** API methods *need* to be implemented for basic read/write
 * functionality.
 *
 * Note that read-only FileSystems can choose to not implement core methods
 * that mutate files or metadata. The default implementation will pass a
 * NOT_SUPPORTED error to the callback.
 *
 * ### Supplemental Methods
 *
 * **Supplemental** API methods do not need to be implemented by a filesystem.
 * The default implementation implements all of the supplemental API methods in
 * terms of the **core** API methods.
 *
 * Note that a file system may choose to implement supplemental methods for
 * efficiency reasons.
 *
 * The code for some supplemental methods was adapted directly from NodeJS's
 * fs.js source code.
 *
 * ### Optional Methods
 *
 * **Optional** API methods provide functionality that may not be available in
 * all filesystems. For example, all symlink/hardlink-related API methods fall
 * under this category.
 *
 * The default implementation will pass a NOT_SUPPORTED error to the callback.
 *
 * ### Argument Assumptions
 *
 * You can assume the following about arguments passed to each API method:
 *
 * * **Every path is an absolute path.** Meaning, `.`, `..`, and other items
 *   are resolved into an absolute form.
 * * **All arguments are present.** Any optional arguments at the Node API level
 *   have been passed in with their default values.
 * * **The callback will reset the stack depth.** When your filesystem calls the
 *   callback with the requested information, it will use `setImmediate` to
 *   reset the JavaScript stack depth before calling the user-supplied callback.
 */
export interface IFileSystem {
  /**
   * **Optional**: Returns the name of the file system.
   */
  getName(): string;
  /**
   * **Optional**: Passes the following information to the callback:
   *
   * * Total number of bytes available on this file system.
   * * number of free bytes available on this file system.
   *
   * @todo This info is not available through the Node API. Perhaps we could do a
   *   polyfill of diskspace.js, or add a new Node API function.
   * @param path The path to the location that is being queried. Only
   *   useful for filesystems that support mount points.
   */
  diskSpace(p: string, cb: (total: number, free: number) => any): void;
  /**
   * **Core**: Is this filesystem read-only?
   * @return True if this FileSystem is inherently read-only.
   */
  isReadOnly(): boolean;
  /**
   * **Core**: Does the filesystem support optional symlink/hardlink-related
   *   commands?
   * @return True if the FileSystem supports the optional
   *   symlink/hardlink-related commands.
   */
  supportsLinks(): boolean;
  /**
   * **Core**: Does the filesystem support optional property-related commands?
   * @return True if the FileSystem supports the optional
   *   property-related commands (permissions, utimes, etc).
   */
  supportsProps(): boolean;
  /**
   * **Core**: Does the filesystem support the optional synchronous interface?
   * @return True if the FileSystem supports synchronous operations.
   */
  supportsSynch(): boolean;
  // **CORE API METHODS**
  // File or directory operations
  /**
   * **Core**: Asynchronous rename. No arguments other than a possible exception
   * are given to the completion callback.
   */
  rename(oldPath: string, newPath: string): Promise<void>;
  /**
   * **Core**: Synchronous rename.
   */
  renameSync(oldPath: string, newPath: string): void;
  /**
   * **Core**: Asynchronous `stat` or `lstat`.
   * @param isLstat True if this is `lstat`, false if this is regular
   *   `stat`.
   */
  stat(p: string, isLstat: boolean | null): Promise<Stats>;
  /**
   * **Core**: Synchronous `stat` or `lstat`.
   * @param isLstat True if this is `lstat`, false if this is regular
   *   `stat`.
   */
  statSync(p: string, isLstat: boolean | null): Stats;
  // File operations
  /**
   * **Core**: Asynchronous file open.
   * @see http://www.manpagez.com/man/2/open/
   * @param flags Handles the complexity of the various file
   *   modes. See its API for more details.
   * @param mode Mode to use to open the file. Can be ignored if the
   *   filesystem doesn't support permissions.
   */
  open(p: string, flag: FileFlagString, mode: number): Promise<File>;
  /**
   * **Core**: Synchronous file open.
   * @see http://www.manpagez.com/man/2/open/
   * @param flags Handles the complexity of the various file
   *   modes. See its API for more details.
   * @param mode Mode to use to open the file. Can be ignored if the
   *   filesystem doesn't support permissions.
   */
  openSync(p: string, flag: FileFlagString, mode: number): File;
  /**
   * **Core**: Asynchronous `unlink`.
   */
  unlink(p: string): Promise<void>;
  /**
   * **Core**: Synchronous `unlink`.
   */
  unlinkSync(p: string): void;
  // Directory operations
  /**
   * **Core**: Asynchronous `rmdir`.
   */
  rmdir(p: string): Promise<void>;
  /**
   * **Core**: Synchronous `rmdir`.
   */
  rmdirSync(p: string): void;
  /**
   * **Core**: Asynchronous `mkdir`.
   * @param mode Mode to make the directory using. Can be ignored if
   *   the filesystem doesn't support permissions.
   */
  mkdir(p: string, mode: number): Promise<void>;
  /**
   * **Core**: Synchronous `mkdir`.
   * @param mode Mode to make the directory using. Can be ignored if
   *   the filesystem doesn't support permissions.
   */
  mkdirSync(p: string, mode: number): void;
  /**
   * **Core**: Asynchronous `readdir`. Reads the contents of a directory.
   *
   * The callback gets two arguments `(err, files)` where `files` is an array of
   * the names of the files in the directory excluding `'.'` and `'..'`.
   */
  readdir(p: string): Promise<string[]>;
  /**
   * **Core**: Synchronous `readdir`. Reads the contents of a directory.
   */
  readdirSync(p: string): string[];
  // **SUPPLEMENTAL INTERFACE METHODS**
  // File or directory operations
  /**
   * **Supplemental**: Test whether or not the given path exists by checking with
   * the file system. Then call the callback argument with either true or false.
   */
  exists(p: string): Promise<boolean>;
  /**
   * **Supplemental**: Test whether or not the given path exists by checking with
   * the file system.
   */
  existsSync(p: string): boolean;
  /**
   * **Supplemental**: Asynchronous `realpath`. The callback gets two arguments
   * `(err, resolvedPath)`.
   *
   * Note that the Node API will resolve `path` to an absolute path.
   * @param cache An object literal of mapped paths that can be used to
   *   force a specific path resolution or avoid additional `fs.stat` calls for
   *   known real paths. If not supplied by the user, it'll be an empty object.
   */
  realpath(p: string, cache: { [path: string]: string }): Promise<string>;
  /**
   * **Supplemental**: Synchronous `realpath`.
   *
   * Note that the Node API will resolve `path` to an absolute path.
   * @param cache An object literal of mapped paths that can be used to
   *   force a specific path resolution or avoid additional `fs.stat` calls for
   *   known real paths. If not supplied by the user, it'll be an empty object.
   */
  realpathSync(p: string, cache: { [path: string]: string }): string;
  // File operations
  /**
   * **Supplemental**: Asynchronous `truncate`.
   */
  truncate(p: string, len: number): Promise<void>;
  /**
   * **Supplemental**: Synchronous `truncate`.
   */
  truncateSync(p: string, len: number): void;
  /**
   * **Supplemental**: Asynchronously reads the entire contents of a file.
   * @param encoding If non-null, the file's contents should be decoded
   *   into a string using that encoding. Otherwise, if encoding is null, fetch
   *   the file's contents as a Buffer.
   * @param cb If no encoding is specified, then the raw buffer is returned.
   */
  readFile(fname: string, encoding: string | null, flag: FileFlagString): Promise<string | Buffer>;
  /**
   * **Supplemental**: Synchronously reads the entire contents of a file.
   * @param encoding If non-null, the file's contents should be decoded
   *   into a string using that encoding. Otherwise, if encoding is null, fetch
   *   the file's contents as a Buffer.
   */
  readFileSync(fname: string, encoding: string | null, flag: FileFlagString): any;
  /**
   * **Supplemental**: Asynchronously writes data to a file, replacing the file
   * if it already exists.
   *
   * The encoding option is ignored if data is a buffer.
   */
  writeFile(
    fname: string,
    data: any,
    encoding: string | null,
    flag: FileFlagString,
    mode: number,
  ): Promise<void>;
  /**
   * **Supplemental**: Synchronously writes data to a file, replacing the file
   * if it already exists.
   *
   * The encoding option is ignored if data is a buffer.
   */
  writeFileSync(
    fname: string,
    data: string | Buffer,
    encoding: string | null,
    flag: FileFlagString,
    mode: number,
  ): void;
  /**
   * **Supplemental**: Asynchronously append data to a file, creating the file if
   * it not yet exists.
   */
  appendFile(
    fname: string,
    data: string | Buffer,
    encoding: string | null,
    flag: FileFlagString,
    mode: number,
  ): Promise<void>;
  /**
   * **Supplemental**: Synchronously append data to a file, creating the file if
   * it not yet exists.
   */
  appendFileSync(
    fname: string,
    data: string | Buffer,
    encoding: string | null,
    flag: FileFlagString,
    mode: number,
  ): void;
  // **OPTIONAL INTERFACE METHODS**
  // Property operations
  // This isn't always possible on some filesystem types (e.g. Dropbox).
  /**
   * **Optional**: Asynchronous `chmod` or `lchmod`.
   * @param isLchmod `True` if `lchmod`, false if `chmod`. Has no
   *   bearing on result if links aren't supported.
   */
  chmod(p: string, isLchmod: boolean, mode: number): Promise<void>;
  /**
   * **Optional**: Synchronous `chmod` or `lchmod`.
   * @param isLchmod `True` if `lchmod`, false if `chmod`. Has no
   *   bearing on result if links aren't supported.
   */
  chmodSync(p: string, isLchmod: boolean, mode: number): void;
  /**
   * **Optional**: Asynchronous `chown` or `lchown`.
   * @param isLchown `True` if `lchown`, false if `chown`. Has no
   *   bearing on result if links aren't supported.
   */
  chown(p: string, isLchown: boolean, uid: number, gid: number): Promise<void>;
  /**
   * **Optional**: Synchronous `chown` or `lchown`.
   * @param isLchown `True` if `lchown`, false if `chown`. Has no
   *   bearing on result if links aren't supported.
   */
  chownSync(p: string, isLchown: boolean, uid: number, gid: number): void;
  /**
   * **Optional**: Change file timestamps of the file referenced by the supplied
   * path.
   */
  utimes(p: string, atime: Date, mtime: Date): Promise<void>;
  /**
   * **Optional**: Change file timestamps of the file referenced by the supplied
   * path.
   */
  utimesSync(p: string, atime: Date, mtime: Date): void;
  // Symlink operations
  // Symlinks aren't always supported.
  /**
   * **Optional**: Asynchronous `link`.
   */
  link(srcpath: string, dstpath: string): Promise<void>;
  /**
   * **Optional**: Synchronous `link`.
   */
  linkSync(srcpath: string, dstpath: string): void;
  /**
   * **Optional**: Asynchronous `symlink`.
   * @param type can be either `'dir'` or `'file'`
   */
  symlink(srcpath: string, dstpath: string, type: string): Promise<void>;
  /**
   * **Optional**: Synchronous `symlink`.
   * @param type can be either `'dir'` or `'file'`
   */
  symlinkSync(srcpath: string, dstpath: string, type: string): void;
  /**
   * **Optional**: Asynchronous readlink.
   */
  readlink(p: string): Promise<string>;
  /**
   * **Optional**: Synchronous readlink.
   */
  readlinkSync(p: string): string;
}

/**
 * Describes a file system option.
 */
export interface FileSystemOption<T> {
  // The basic JavaScript type(s) for this option.
  type: string | string[];
  // Whether or not the option is optional (e.g., can be set to null or undefined).
  // Defaults to `false`.
  optional?: boolean;
  // Description of the option. Used in error messages and documentation.
  description: string;
  // A custom validation function to check if the option is valid.
  // Calls the callback with an error object on an error.
  // (Can call callback synchronously.)
  // Defaults to `(opt, cb) => cb()`.
  validator?(opt: T): Promise<void>;
}

/**
 * Describes all of the options available in a file system.
 */
export interface FileSystemOptions {
  [name: string]: FileSystemOption<any>;
}

/**
 * Contains typings for static functions on the file system constructor.
 */
export interface FileSystemConstructor {
  /**
   * **Core**: Name to identify this particular file system.
   */
  Name: string;
  /**
   * **Core**: Describes all of the options available for this file system.
   */
  Options: FileSystemOptions;
  /**
   * **Core**: Creates a file system of this given type with the given
   * options.
   */
  Create(options: object): Promise<IFileSystem>;
  /**
   * **Core**: Returns 'true' if this filesystem is available in the current
   * environment. For example, a `localStorage`-backed filesystem will return
   * 'false' if the browser does not support that API.
   *
   * Defaults to 'false', as the FileSystem base class isn't usable alone.
   */
  isAvailable(): boolean;

  /**
   * **Core**: Returns 'true' if this filesystem has a watch mode for files or
   * folders.
   *
   * Defaults to 'false', as the FileSystem base class isn't usable alone.
   */
  isWatchable?(): boolean;

  watch?(p: string, persistent: boolean);
}

/**
 * Basic filesystem class. Most filesystems should extend this class, as it
 * provides default implementations for a handful of methods.
 */
export class BaseFileSystem {
  public supportsLinks(): boolean {
    return false;
  }
  public diskSpace(p: string, cb: (total: number, free: number) => any): void {
    cb(0, 0);
  }
  /**
   * Opens the file at path p with the given flag. The file must exist.
   * @param p The path to open.
   * @param flag The flag to use when opening the file.
   */
  public openFile(p: string, flag: FileFlagString): Promise<File> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  /**
   * Create the file at path p with the given mode. Then, open it with the given
   * flag.
   *
   * SHOULD BE IMPLEMENTED FOR ALL NEW FILESYSTEMS
   */
  public async createFile(p: string, flag: FileFlagString, mode: number): Promise<File> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public async open(p: string, flag: FileFlagString, mode: number): Promise<File> {
    try {
      let stats = await this.stat(p, false);
      if (stats && stats.isDirectory) {
        throw ApiError.EISDIR(p);
      }
      switch (pathExistsAction(flag)) {
        case ActionType.THROW_EXCEPTION:
          throw ApiError.EEXIST(p);
        case ActionType.TRUNCATE_FILE:
          // NOTE: In a previous implementation, we deleted the file and
          // re-created it. However, this created a race condition if another
          // asynchronous request was trying to read the file, as the file
          // would not exist for a small period of time.
          let file = await this.openFile(p, flag);
          await file.truncate(0);
          await file.sync();
          return file;

        case ActionType.NOP:
          return await this.openFile(p, flag);
      }
    } catch (e) {
      switch (getActionTypeIfNotExists(flag)) {
        case ActionType.CREATE_FILE:
          // Ensure parent exists.
          let parentStats = await this.stat(path.dirname(p), false);
          if (parentStats && !parentStats.isDirectory) {
            throw ApiError.ENOTDIR(path.dirname(p));
          }

          return await this.createFile(p, flag, mode);
        case ActionType.THROW_EXCEPTION:
        default:
          throw e;
      }
    }
  }

  public async rename(oldPath: string, newPath: string): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public renameSync(oldPath: string, newPath: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async stat(p: string, isLstat: boolean | null): Promise<Stats> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public statSync(p: string, isLstat: boolean | null): Stats {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  /**
   * Opens the file at path p with the given flag. The file must exist.
   * @param p The path to open.
   * @param flag The flag to use when opening the file.
   * @return A File object corresponding to the opened file.
   */
  public openFileSync(p: string, flag: FileFlagString, mode: number): File {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  /**
   * Create the file at path p with the given mode. Then, open it with the given
   * flag.
   */
  public createFileSync(p: string, flag: FileFlagString, mode: number): File {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public openSync(p: string, flag: FileFlagString, mode: number): File {
    // Check if the path exists, and is a file.
    let stats: Stats;
    try {
      stats = this.statSync(p, false);
    } catch (e) {
      // File does not exist.
      switch (getActionTypeIfNotExists(flag)) {
        case ActionType.CREATE_FILE:
          // Ensure parent exists.
          let parentStats;
          try {
            parentStats = this.statSync(path.dirname(p), false);
          } catch (e) {
            mkdirpSync(path.dirname(p), 0x644, this);
            parentStats = this.statSync(path.dirname(p), false);
          }

          if (!parentStats.isDirectory()) {
            throw ApiError.ENOTDIR(path.dirname(p));
          }
          return this.createFileSync(p, flag, mode);
        case ActionType.THROW_EXCEPTION:
          throw ApiError.ENOENT(p);
        default:
          throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
      }
    }

    // File exists.
    if (stats.isDirectory) {
      throw ApiError.EISDIR(p);
    }
    switch (pathExistsAction(flag)) {
      case ActionType.THROW_EXCEPTION:
        throw ApiError.EEXIST(p);
      case ActionType.TRUNCATE_FILE:
        // Delete file.
        this.unlinkSync(p);
        // Create file. Use the same mode as the old file.
        // Node itself modifies the ctime when this occurs, so this action
        // will preserve that behavior if the underlying file system
        // supports those properties.
        return this.createFileSync(p, flag, stats.mode);
      case ActionType.NOP:
        return this.openFileSync(p, flag, mode);
      default:
        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
    }
  }

  public async unlink(p: string): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public unlinkSync(p: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public async rmdir(p: string): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public rmdirSync(p: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public async mkdir(p: string, mode: number): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public mkdirSync(p: string, mode: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public async readdir(p: string): Promise<string[]> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public readdirSync(p: string): string[] {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public async exists(p: string): Promise<boolean> {
    try {
      await this.stat(p, true);
      return true;
    } catch (e) {
      return false;
    }
  }

  public existsSync(p: string): boolean {
    try {
      this.statSync(p, true);
      return true;
    } catch (e) {
      return false;
    }
  }

  public async realpath(p: string, cache: { [path: string]: string }): Promise<string> {
    if (this.supportsLinks()) {
      // The path could contain symlinks. Split up the path,
      // resolve any symlinks, return the resolved string.
      const splitPath = p.split(path.sep);
      // TODO: Simpler to just pass through file, find sep and such.
      for (let i = 0; i < splitPath.length; i++) {
        const addPaths = splitPath.slice(0, i + 1);
        splitPath[i] = path.join.apply(null, addPaths);
      }
    } else {
      // No symlinks. We just need to verify that it exists.
      if (await this.exists(p)) {
        return p;
      } else {
        throw new ApiError(ErrorCode.ENOENT, p);
      }
    }
  }

  public realpathSync(p: string, cache: { [path: string]: string }): string {
    if (this.supportsLinks()) {
      // The path could contain symlinks. Split up the path,
      // resolve any symlinks, return the resolved string.
      const splitPath = p.split(path.sep);
      // TODO: Simpler to just pass through file, find sep and such.
      for (let i = 0; i < splitPath.length; i++) {
        const addPaths = splitPath.slice(0, i + 1);
        splitPath[i] = path.join.apply(path, addPaths);
      }
      return splitPath.join(path.sep);
    } else {
      // No symlinks. We just need to verify that it exists.
      if (this.existsSync(p)) {
        return p;
      } else {
        throw ApiError.ENOENT(p);
      }
    }
  }

  public async truncate(p: string, len: number): Promise<void> {
    let file = await this.open(p, constants.fs.O_RDWR, 0x1a4);
    try {
      await file.truncate(len);
    } catch (e) {}
    await file.close();
  }

  public truncateSync(p: string, len: number): void {
    const fd = this.openSync(p, constants.fs.O_RDWR, 0x1a4);
    // Need to safely close FD, regardless of whether or not truncate succeeds.
    try {
      fd.truncateSync(len);
    } catch (e) {
      throw e;
    } finally {
      fd.closeSync();
    }
  }

  public async readFile(
    fname: string,
    encoding: BufferEncoding,
    flag: FileFlagString,
  ): Promise<string | Buffer> {
    // Wrap cb in file closing code.
    // Get file.
    let file = await this.open(fname, flag, 0x1a4);

    let stat = await file.stat();
    const buf = Buffer.alloc(stat!.size);
    let n = await file.read(buf, 0, stat!.size, 0);

    if (encoding === null) {
      return buf;
    } else {
      return buf.toString(encoding);
    }
  }

  public readFileSync(fname: string, encoding: BufferEncoding, flag: FileFlagString): any {
    // Get file.
    const fd = this.openSync(fname, flag, 0x1a4);
    try {
      const stat = fd.statSync();
      // Allocate buffer.
      const buf = Buffer.alloc(stat.size);
      fd.readSync(buf, 0, stat.size, 0);
      fd.closeSync();
      if (encoding === null) {
        return buf;
      }
      return buf.toString(encoding);
    } finally {
      fd.closeSync();
    }
  }
  public async writeFile(
    fname: string,
    data: any,
    encoding: BufferEncoding,
    flag: FileFlagString,
    mode: number,
  ): Promise<void> {
    // Wrap cb in file closing code.
    // Get file.
    if (typeof data === 'string') {
      data = Buffer.from(data, encoding!);
    }
    let file = await this.open(fname, flag, 0x1a4);

    try {
      await file!.write(data, 0, data.length, null);
    } catch (e) {
      await file.close();
      throw e;
    } finally {
      await file.close();
    }
    file!.write(data, 0, data.length, 0);
  }
  public writeFileSync(
    fname: string,
    data: any,
    encoding: BufferEncoding,
    flag: FileFlagString,
    mode: number,
  ): void {
    // Get file.
    const fd = this.openSync(fname, flag, mode);
    try {
      if (typeof data === 'string') {
        data = Buffer.from(data, encoding!);
      }
      // Write into file.
      fd.writeSync(data, 0, data.length, 0);
    } finally {
      fd.closeSync();
    }
  }
  public async appendFile(
    fname: string,
    data: any,
    encoding: BufferEncoding,
    flag: FileFlagString,
    mode: number,
  ): Promise<void> {
    if (typeof data === 'string') {
      data = Buffer.from(data, encoding!);
    }
    let file = await this.open(fname, flag, mode);

    try {
      await file!.write(data, 0, data.length, null);
    } catch (e) {
      await file.close();
      throw e;
    } finally {
      await file.close();
    }
  }
  public appendFileSync(
    fname: string,
    data: any,
    encoding: BufferEncoding,
    flag: FileFlagString,
    mode: number,
  ): void {
    const fd = this.openSync(fname, flag, mode);
    try {
      if (typeof data === 'string') {
        data = Buffer.from(data, encoding!);
      }
      fd.writeSync(data, 0, data.length, null);
    } finally {
      fd.closeSync();
    }
  }
  public async chmod(p: string, isLchmod: boolean, mode: number): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public chmodSync(p: string, isLchmod: boolean, mode: number) {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async chown(p: string, isLchown: boolean, uid: number, gid: number): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async utimes(p: string, atime: Date, mtime: Date): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public utimesSync(p: string, atime: Date, mtime: Date): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async link(srcpath: string, dstpath: string): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public linkSync(srcpath: string, dstpath: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async symlink(srcpath: string, dstpath: string, type: string): Promise<void> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public symlinkSync(srcpath: string, dstpath: string, type: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public async readlink(p: string): Promise<string> {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public readlinkSync(p: string): string {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}

/**
 * Implements the asynchronous API in terms of the synchronous API.
 * @class SynchronousFileSystem
 */
export class SynchronousFileSystem extends BaseFileSystem {
  public supportsSynch(): boolean {
    return true;
  }

  public async rename(oldPath: string, newPath: string): Promise<void> {
    this.renameSync(oldPath, newPath);
  }

  public async stat(p: string, isLstat: boolean | null): Promise<Stats> {
    return this.statSync(p, isLstat);
  }

  public async open(p: string, flags: FileFlagString, mode: number): Promise<File> {
    return this.openSync(p, flags, mode);
  }

  public async unlink(p: string): Promise<void> {
    this.unlinkSync(p);
  }

  public async rmdir(p: string): Promise<void> {
    this.rmdirSync(p);
  }

  public async mkdir(p: string, mode: number): Promise<void> {
    this.mkdirSync(p, mode);
  }

  public async readdir(p: string): Promise<string[]> {
    return this.readdirSync(p);
  }

  public async chmod(p: string, isLchmod: boolean, mode: number): Promise<void> {
    this.chmodSync(p, isLchmod, mode);
  }

  public async chown(p: string, isLchown: boolean, uid: number, gid: number): Promise<void> {
    this.chownSync(p, isLchown, uid, gid);
  }

  public async utimes(p: string, atime: Date, mtime: Date): Promise<void> {
    this.utimesSync(p, atime, mtime);
  }

  public async link(srcpath: string, dstpath: string): Promise<void> {
    this.linkSync(srcpath, dstpath);
  }

  public async symlink(srcpath: string, dstpath: string, type: string): Promise<void> {
    this.symlinkSync(srcpath, dstpath, type);
  }

  public async readlink(p: string): Promise<string> {
    return this.readlinkSync(p);
  }
}
