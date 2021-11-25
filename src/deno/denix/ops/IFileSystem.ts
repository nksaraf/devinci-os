import { File } from 'os/kernel/fs/core/file';
import { DirEntry } from './fs';

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
  get name(): string;
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
  get isReadOnly(): boolean;
  /**
   * **Core**: Does the filesystem support optional symlink/hardlink-related
   *   commands?
   * @return True if the FileSystem supports the optional
   *   symlink/hardlink-related commands.
   */
  get supportsLinks(): boolean;
  /**
   * **Core**: Does the filesystem support optional property-related commands?
   * @return True if the FileSystem supports the optional
   *   property-related commands (permissions, utimes, etc).
   */
  get supportsProps(): boolean;
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
  stat(p: string, isLstat: boolean | null): Promise<Deno.FileInfo>;
  /**
   * **Core**: Synchronous `stat` or `lstat`.
   * @param isLstat True if this is `lstat`, false if this is regular
   *   `stat`.
   */
  statSync(p: string, isLstat: boolean | null): Deno.FileInfo;
  // File operations
  /**
   * **Core**: Asynchronous file open.
   * @see http://www.manpagez.com/man/2/open/
   * @param flags Handles the complexity of the various file
   *   modes. See its API for more details.
   * @param mode Mode to use to open the file. Can be ignored if the
   *   filesystem doesn't support permissions.
   */
  open(p: string, options: Deno.OpenOptions): Promise<File>;
  /**
   * **Core**: Synchronous file open.
   * @see http://www.manpagez.com/man/2/open/
   * @param flags Handles the complexity of the various file
   *   modes. See its API for more details.
   * @param mode Mode to use to open the file. Can be ignored if the
   *   filesystem doesn't support permissions.
   */
  openSync(p: string, options: Deno.OpenOptions): File;
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
   * **Core**: Asynchronous `remove`.
   */
  remove(p: string): Promise<void>;
  /**
   * **Core**: Synchronous `remove`.
   */
  removeSync(p: string): void;
  /**
   * **Core**: Asynchronous `mkdir`.
   * @param mode Mode to make the directory using. Can be ignored if
   *   the filesystem doesn't support permissions.
   */
  mkdir(p: string, options?: { recursive?: boolean; mode?: number; }): Promise<void>;
  /**
   * **Core**: Synchronous `mkdir`.
   * @param mode Mode to make the directory using. Can be ignored if
   *   the filesystem doesn't support permissions.
   */
  mkdirSync(p: string, options?: { recursive?: boolean; mode?: number; }): void;
  /**
   * **Core**: Asynchronous `readdir`. Reads the contents of a directory.
   *
   * The callback gets two arguments `(err, files)` where `files` is an array of
   * the names of the files in the directory excluding `'.'` and `'..'`.
   */
  readDir(p: string): Promise<DirEntry[]>;
  /**
   * **Core**: Synchronous `readdir`. Reads the contents of a directory.
   */
  readDirSync(p: string): DirEntry[];
  // **SUPPLEMENTAL INTERFACE METHODS**
  /**
   * **Supplemental**: Asynchronous `realpath`. The callback gets two arguments
   * `(err, resolvedPath)`.
   *
   * Note that the Node API will resolve `path` to an absolute path.
   * @param cache An object literal of mapped paths that can be used to
   *   force a specific path resolution or avoid additional `fs.stat` calls for
   *   known real paths. If not supplied by the user, it'll be an empty object.
   */
  realPath(p: string, cache: { [path: string]: string; }): Promise<string>;
  /**
   * **Supplemental**: Synchronous `realpath`.
   *
   * Note that the Node API will resolve `path` to an absolute path.
   * @param cache An object literal of mapped paths that can be used to
   *   force a specific path resolution or avoid additional `fs.stat` calls for
   *   known real paths. If not supplied by the user, it'll be an empty object.
   */
  realPathSync(p: string, cache: { [path: string]: string; }): string;
  // File operations
  /**
   * **Supplemental**: Asynchronous `truncate`.
   */
  truncate(p: string, len: number): Promise<void>;
  /**
   * **Supplemental**: Synchronous `truncate`.
   */
  truncateSync(p: string, len: number): void;
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
  symlink(srcpath: string, dstpath: string, options: Deno.SymlinkOptions): Promise<void>;
  /**
   * **Optional**: Synchronous `symlink`.
   * @param type can be either `'dir'` or `'file'`
   */
  symlinkSync(srcpath: string, dstpath: string, type: string): void;
  /**
   * **Optional**: Asynchronous readlink.
   */
  readLink(p: string): Promise<string>;
  /**
   * **Optional**: Synchronous readlink.
   */
  readLinkSync(p: string): string;
}
