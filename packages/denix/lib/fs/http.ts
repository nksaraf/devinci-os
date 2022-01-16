import { BaseFileSystem } from './core/file_system.ts';
import type { IFileSystem, FileSystemOptions } from './core/file_system.ts';
import { ApiError, ErrorCode } from '../error.ts';
import type { FileFlagString } from './core/file_flag.ts';
import { ActionType, isWriteable, pathExistsAction } from './core/file_flag.ts';
import { copyingSlice } from './utils/util.ts';
import type { File } from './core/file.ts';
import Stats from './core/stats.ts';
import { NoSyncFile } from './core/inmemory_file.ts';
import {
  xhrIsAvailable,
  asyncDownloadFile,
  syncDownloadFile,
  getFileSizeAsync,
  getFileSizeSync,
} from '../xhr.ts';
import { fetchIsAvailable, fetchFileAsync, fetchFileSizeAsync } from '../fetch.ts';
import { FileIndex, isFileInode, isDirInode } from './core/file_index.ts';
import type { Buffer } from 'buffer';

/**
 * Try to convert the given buffer into a string, and pass it to the callback.
 * Optimization that removes the needed try/catch into a helper function, as
 * this is an uncommon case.
 * @hidden
 */
function tryToString(buff: Buffer, encoding: BufferEncoding) {
  return buff.toString(encoding);
}

/**
 * Configuration options for a HTTPRequest file system.
 */
export interface HTTPRequestOptions {
  // URL to a file index as a JSON file or the file index object itself, generated with the make_http_index script.
  // Defaults to `index.json`.
  index?: string | object;
  // Used as the URL prefix for fetched files.
  // Default: Fetch files relative to the index.
  baseUrl?: string;
  // Whether to prefer XmlHttpRequest or fetch for async operations if both are available.
  // Default: false
  preferXHR?: boolean;
}

interface AsyncDownloadFileMethod {
  (p: string, type: 'buffer'): Promise<Buffer>;
  (p: string, type: 'json'): Promise<any>;
  (p: string, type: string): Promise<any>;
}

interface SyncDownloadFileMethod {
  (p: string, type: 'buffer'): Buffer;
  (p: string, type: 'json'): any;
  (p: string, type: string): any;
}

function syncNotAvailableError(): never {
  throw new ApiError(
    ErrorCode.ENOTSUP,
    `Synchronous HTTP download methods are not available in this environment.`,
  );
}

/**
 * A simple filesystem backed by HTTP downloads. You must create a directory listing using the
 * `make_http_index` tool provided by BrowserFS.
 *
 * If you install BrowserFS globally with `npm i -g browserfs`, you can generate a listing by
 * running `make_http_index` in your terminal in the directory you would like to index:
 *
 * ```
 * make_http_index > index.json
 * ```
 *
 * Listings objects look like the following:
 *
 * ```json
 * {
 *   "home": {
 *     "jvilk": {
 *       "someFile.txt": null,
 *       "someDir": {
 *         // Empty directory
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * *This example has the folder `/home/jvilk` with subfile `someFile.txt` and subfolder `someDir`.*
 */
export default class HTTPRequest extends BaseFileSystem implements IFileSystem {
  public static readonly Name = 'HTTPRequest';

  public static readonly Options: FileSystemOptions = {
    index: {
      type: ['string', 'object'],
      optional: true,
      description:
        'URL to a file index as a JSON file or the file index object itself, generated with the make_http_index script. Defaults to `index.json`.',
    },
    baseUrl: {
      type: 'string',
      optional: true,
      description:
        'Used as the URL prefix for fetched files. Default: Fetch files relative to the index.',
    },
    preferXHR: {
      type: 'boolean',
      optional: true,
      description:
        'Whether to prefer XmlHttpRequest or fetch for async operations if both are available. Default: false',
    },
  };

  /**
   * Construct an HTTPRequest file system backend with the given options.
   */
  public static async Create(opts: HTTPRequestOptions): Promise<HTTPRequest> {
    if (opts.index === undefined) {
      opts.index = `index.json`;
    }
    if (typeof opts.index === 'string') {
      let data = await asyncDownloadFile(opts.index, 'json');
      return new HTTPRequest(data, opts.baseUrl);
    } else {
      return new HTTPRequest(opts.index, opts.baseUrl);
    }
  }

  public static isAvailable(): boolean {
    return xhrIsAvailable || fetchIsAvailable;
  }

  public readonly prefixUrl: string;
  private _index: FileIndex<{}>;
  private _requestFileAsyncInternal: AsyncDownloadFileMethod;
  private _requestFileSizeAsyncInternal: (p: string) => Promise<number>;
  private _requestFileSyncInternal: SyncDownloadFileMethod;
  private _requestFileSizeSyncInternal: (p: string) => number;

  private constructor(index: object, prefixUrl: string = '', preferXHR: boolean = false) {
    super();
    // prefix_url must end in a directory separator.
    if (prefixUrl.length > 0 && prefixUrl.charAt(prefixUrl.length - 1) !== '/') {
      prefixUrl = prefixUrl + '/';
    }
    this.prefixUrl = prefixUrl;
    this._index = FileIndex.fromListing(index);

    if (fetchIsAvailable && (!preferXHR || !xhrIsAvailable)) {
      this._requestFileAsyncInternal = fetchFileAsync;
      this._requestFileSizeAsyncInternal = fetchFileSizeAsync;
    } else {
      this._requestFileAsyncInternal = asyncDownloadFile;
      this._requestFileSizeAsyncInternal = getFileSizeAsync;
    }

    if (xhrIsAvailable) {
      console.debug('XHR IS AVAILABLE');
      this._requestFileSyncInternal = syncDownloadFile;
      this._requestFileSizeSyncInternal = getFileSizeSync;
    } else {
      this._requestFileSyncInternal = syncNotAvailableError;
      this._requestFileSizeSyncInternal = syncNotAvailableError;
    }
  }

  public empty(): void {
    this._index.fileIterator(function (file: Stats) {
      file.fileData = null;
    });
  }

  public getName(): string {
    return HTTPRequest.Name;
  }

  public diskSpace(path: string, cb: (total: number, free: number) => void): void {
    // Read-only file system. We could calculate the total space, but that's not
    // important right now.
    cb(0, 0);
  }

  public isReadOnly(): boolean {
    return true;
  }

  public supportsLinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    // Synchronous operations are only available via the XHR interface for now.
    return xhrIsAvailable;
  }

  /**
   * Special HTTPFS function: Preload the given file into the index.
   * @param [String] path
   * @param [BrowserFS.Buffer] buffer
   */
  public preloadFile(path: string, buffer: Buffer): void {
    const inode = this._index.getInode(path);
    if (isFileInode<Stats>(inode)) {
      if (inode === null) {
        throw ApiError.ENOENT(path);
      }
      const stats = inode.getData();
      stats.size = buffer.length;
      stats.fileData = buffer;
    } else {
      throw ApiError.EISDIR(path);
    }
  }

  public async stat(path: string, isLstat: boolean): Promise<Stats> {
    const inode = this._index.getInode(path);
    if (inode === null) {
      throw ApiError.ENOENT(path);
    }
    let stats: Stats;
    if (isFileInode<Stats>(inode)) {
      stats = inode.getData();
      // At this point, a non-opened file will still have default stats from the listing.
      if (stats.size < 0) {
        let size = await this._requestFileSizeAsync(path);

        stats.size = size!;
        return Stats.clone(stats);
      } else {
        return Stats.clone(stats);
      }
    } else if (isDirInode(inode)) {
      stats = inode.getStats();
      return stats;
    } else {
      throw ApiError.FileError(ErrorCode.EINVAL, path);
    }
  }

  public statSync(path: string, isLstat: boolean): Stats {
    const inode = this._index.getInode(path);
    if (inode === null) {
      throw ApiError.ENOENT(path);
    }
    let stats: Stats;
    if (isFileInode<Stats>(inode)) {
      stats = inode.getData();
      // At this point, a non-opened file will still have default stats from the listing.
      if (stats.size < 0) {
        stats.size = this._requestFileSizeSync(path);
      }
    } else if (isDirInode(inode)) {
      stats = inode.getStats();
    } else {
      throw ApiError.FileError(ErrorCode.EINVAL, path);
    }
    return stats;
  }

  public async open(path: string, flags: FileFlagString, mode: number): Promise<File> {
    // INVARIANT: You can't write to files on this file system.
    if (isWriteable(flags)) {
      throw new ApiError(ErrorCode.EPERM, path);
    }
    // Check if the path exists, and is a file.
    const inode = this._index.getInode(path);
    if (inode === null) {
      throw ApiError.ENOENT(path);
    }
    if (!isFileInode<Stats>(inode)) {
      throw ApiError.EISDIR(path);
    }
    const stats = inode.getData();
    switch (pathExistsAction(flags)) {
      case ActionType.THROW_EXCEPTION:
      case ActionType.TRUNCATE_FILE:
        throw ApiError.EEXIST(path);
      case ActionType.NOP:
        // Use existing file contents.
        // XXX: Uh, this maintains the previously-used flag.
        if (stats.fileData) {
          return new NoSyncFile(this, path, flags, Stats.clone(stats), stats.fileData);
        }
        // @todo be lazier about actually requesting the file
        let buffer = await this._requestFileAsync(path, 'buffer');

        // we don't initially have file sizes
        stats.size = buffer!.length;
        stats.fileData = buffer!;
        return new NoSyncFile(this, path, flags, Stats.clone(stats), buffer);
      default:
        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
    }
  }

  public openSync(path: string, flags: FileFlagString, mode: number): File {
    // INVARIANT: You can't write to files on this file system.
    if (isWriteable(flags)) {
      throw new ApiError(ErrorCode.EPERM, path);
    }
    // Check if the path exists, and is a file.
    const inode = this._index.getInode(path);
    if (inode === null) {
      throw ApiError.ENOENT(path);
    }
    if (isFileInode<Stats>(inode)) {
      const stats = inode.getData();
      switch (pathExistsAction(flags)) {
        case ActionType.THROW_EXCEPTION:
        case ActionType.TRUNCATE_FILE:
          throw ApiError.EEXIST(path);
        case ActionType.NOP:
          // Use existing file contents.
          // XXX: Uh, this maintains the previously-used flag.
          if (stats.fileData) {
            return new NoSyncFile(this, path, flags, Stats.clone(stats), stats.fileData);
          }
          // @todo be lazier about actually requesting the file
          const buffer = this._requestFileSync(path, 'buffer');
          // we don't initially have file sizes
          stats.size = buffer.length;
          stats.fileData = buffer;
          return new NoSyncFile(this, path, flags, Stats.clone(stats), buffer);
        default:
          throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
      }
    } else {
      throw ApiError.EISDIR(path);
    }
  }

  public async readdir(path: string): Promise<string[]> {
    return this.readdirSync(path);
  }

  public readdirSync(path: string): string[] {
    // Check if it exists.
    const inode = this._index.getInode(path);
    if (inode === null) {
      throw ApiError.ENOENT(path);
    } else if (isDirInode(inode)) {
      return inode.getListing();
    } else {
      throw ApiError.ENOTDIR(path);
    }
  }

  /**
   * We have the entire file as a buffer; optimize readFile.
   */
  public async readFile(
    fname: string,
    encoding: BufferEncoding,
    flag: FileFlagString,
  ): Promise<string | Buffer> {
    // Wrap cb in file closing code.
    // Get file.
    let fd = await this.open(fname, flag, 0x1a4);

    try {
      const fdCast = <NoSyncFile<HTTPRequest>>fd;
      const fdBuff = <Buffer>fdCast.getBufferSync();
      if (encoding === null) {
        return copyingSlice(fdBuff);
      } else {
        return tryToString(fdBuff, encoding);
      }
    } catch (e) {
      fd.close();
      throw e;
    } finally {
      await fd.close();
    }
  }

  /**
   * Specially-optimized readfile.
   */
  public readFileSync(fname: string, encoding: BufferEncoding, flag: FileFlagString): any {
    // Get file.
    const fd = this.openSync(fname, flag, 0x1a4);
    try {
      const fdCast = <NoSyncFile<HTTPRequest>>fd;
      const fdBuff = fdCast.getBufferSync();
      if (encoding === null) {
        return copyingSlice(fdBuff);
      }
      return new TextDecoder(encoding).decode(fdBuff);
    } finally {
      fd.closeSync();
    }
  }

  private _getHTTPPath(filePath: string): string {
    if (filePath.charAt(0) === '/') {
      filePath = filePath.slice(1);
    }
    return this.prefixUrl + filePath;
  }

  /**
   * Asynchronously download the given file.
   */
  private _requestFileAsync(p: string, type: 'buffer'): Promise<Buffer>;
  private _requestFileAsync(p: string, type: 'json'): Promise<any>;
  private _requestFileAsync(p: string, type: string): Promise<any>;
  private async _requestFileAsync(p: string, type: string): Promise<any> {
    return await this._requestFileAsyncInternal(this._getHTTPPath(p), type);
  }

  /**
   * Synchronously download the given file.
   */
  private _requestFileSync(p: string, type: 'buffer'): Buffer;
  private _requestFileSync(p: string, type: 'json'): any;
  private _requestFileSync(p: string, type: string): any;
  private _requestFileSync(p: string, type: string): any {
    return this._requestFileSyncInternal(this._getHTTPPath(p), type);
  }

  /**
   * Only requests the HEAD content, for the file size.
   */
  private async _requestFileSizeAsync(path: string): Promise<number> {
    return await this._requestFileSizeAsyncInternal(this._getHTTPPath(path));
  }

  private _requestFileSizeSync(path: string): number {
    return this._requestFileSizeSyncInternal(this._getHTTPPath(path));
  }
}
