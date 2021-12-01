/**
 * Standard libc error codes. Add more to this enum and ErrorStrings as they are
 * needed.
 * @url http://www.gnu.org/software/libc/manual/html_node/Error-Codes.html
 */
export enum ErrorCode {
  EPERM = 1,
  ENOENT = 2,
  EIO = 5,
  EBADF = 9,
  EACCES = 13,
  EBUSY = 16,
  EEXIST = 17,
  ENOTDIR = 20,
  EISDIR = 21,
  EINVAL = 22,
  EFBIG = 27,
  ENOSPC = 28,
  EROFS = 30,
  ENOTEMPTY = 39,
  ENOTSUP = 95,
  ESPIPE = 32,
  ECONNREFUSED = 61,
  EADDRINUSE,
  EADDRNOTAVAIL,
  ECONNABORTED,
  ECONNRESET,
  EINTR,
  ENOSYS,
  ENOTCONN,
  EPIPE,
  ETIMEDOUT,
}

export const ErrorCodeToName = {
  1: 'EPERM',
  2: 'ENOENT',
  5: 'EIO',
  9: 'EBADF',
  13: 'EACCES',
  16: 'EBUSY',
  17: 'EEXIST',
  20: 'ENOTDIR',
  21: 'EISDIR',
  22: 'EINVAL',
  27: 'EFBIG',
  28: 'ENOSPC',
  30: 'EROFS',
  39: 'ENOTEMPTY',
  95: 'ENOTSUP',
  32: 'ESPIPE',
  61: 'ECONNREFUSED',
  // EADDRINUSE,
  // EADDRNOTAVAIL,
  // ECONNABORTED,
  // ECONNRESET,
  // EINTR,
  // ENOSYS,
  // ENOTCONN,
  // EPIPE,
  // ETIMEDOUT,
};

enum ErrorKind {
  /// An entity was not found, often a file.
  NotFound = 'NotFound',
  /// The operation lacked the necessary privileges to complete.
  PermissionDenied = 'PermissionDenied',
  /// The connection was refused by the remote server.
  ConnectionRefused = 'ConnectionRefused',
  /// The connection was reset by the remote server.
  ConnectionReset = 'ConnectionReset',
  /// The connection was aborted (terminated) by the remote server.
  ConnectionAborted = 'ConnectionAborted',
  /// The network operation failed because it was not connected yet.
  NotConnected = 'NotConnected',
  /// A socket address could not be bound because the address is already in
  /// use elsewhere.
  AddrInUse = 'AddrInUse',
  /// A nonexistent interface was requested or the requested address was not
  /// local.
  AddrNotAvailable = 'AddrNotAvailable',
  /// The operation failed because a pipe was closed.
  BrokenPipe = 'BrokenPipe',
  /// An entity already exists, often a file.
  AlreadyExists = 'AlreadyExists',
  /// The operation needs to block to complete, but the blocking operation was
  /// requested to not occur.
  WouldBlock = 'WouldBlock',
  /// A parameter was incorrect.
  InvalidInput = 'InvalidInput',
  /// Data not valid for the operation were encountered.
  ///
  /// Unlike [`InvalidInput`], this typically means that the operation
  /// parameters were valid, however the error was caused by malformed
  /// input data.
  ///
  /// For example, a function that reads a file into a string will error with
  /// `InvalidData` if the file's contents are not valid UTF-8.
  ///
  /// [`InvalidInput`]: ErrorKind::InvalidInput
  InvalidData = 'InvalidData',
  /// The I/O operation's timeout expired, causing it to be canceled.
  TimedOut = 'TimedOut',
  /// An error returned when an operation could not be completed because a
  /// call to [`write`] returned [`Ok(0)`].
  ///
  /// This typically means that an operation could only succeed if it wrote a
  /// particular number of bytes but only a smaller number of bytes could be
  /// written.
  ///
  /// [`write`]: crate::io::Write::write
  /// [`Ok(0)`]: Ok
  WriteZero = 'WriteZero',
  /// This operation was interrupted.
  ///
  /// Interrupted operations can typically be retried.
  Interrupted = 'Interrupted',
  /// Any I/O error not part of this list.
  ///
  /// Errors that are `Other` now may move to a different or a new
  /// [`ErrorKind`] variant in the future. It is not recommended to match
  /// an error against `Other` and to expect any additional characteristics,
  /// e.g., a specific [`Error::raw_os_error`] return value.
  Other = 'Other',

  /// An error returned when an operation could not be completed because an
  /// "end of file" was reached prematurely.
  ///
  /// This typically means that an operation could only succeed if it read a
  /// particular number of bytes but only a smaller number of bytes could be
  /// read.
  UnexpectedEof = 'UnexpectedEof',

  /// This operation is unsupported on this platform.
  ///
  /// This means that the operation can never succeed.
  Unsupported = 'Unsupported',

  IsADirectory = 'IsADirectory',

  NotADirectory = 'ApiError',
}

export const ERROR_KIND_TO_CODE = {
  // ErrorKind::ArgumentListTooLong => "E2BIG",
  [ErrorKind.AddrInUse]: ErrorCode.EADDRINUSE,
  [ErrorKind.AddrNotAvailable]: ErrorCode.EADDRNOTAVAIL,
  // [ErrorKind.ResourceBusy]:  ErrorCode.EBUSY,
  [ErrorKind.ConnectionAborted]: ErrorCode.ECONNABORTED,
  [ErrorKind.ConnectionRefused]: ErrorCode.ECONNREFUSED,
  [ErrorKind.ConnectionReset]: ErrorCode.ECONNRESET,
  // [ErrorKind.Deadlock]:  ErrorCode.EDEADLK,
  // [ErrorKind.FilesystemQuotaExceeded]:  ErrorCode.EDQUOT,
  [ErrorKind.AlreadyExists]: ErrorCode.EEXIST,
  // [ErrorKind.FileTooLarge]:  ErrorCode.EFBIG,
  // [ErrorKind.HostUnreachable]:  ErrorCode.EHOSTUNREACH,
  [ErrorKind.Interrupted]: ErrorCode.EINTR,
  [ErrorKind.InvalidInput]: ErrorCode.EINVAL,
  [ErrorKind.IsADirectory]: ErrorCode.EISDIR,
  // [ErrorKind.FilesystemLoop]:  ErrorCode.ELOOP,
  [ErrorKind.NotFound]: ErrorCode.ENOENT,
  // [ErrorKind.OutOfMemory]: ErrorCode.ENOMEM,
  // [ErrorKind.StorageFull]:  ErrorCode.ENOSPC,
  [ErrorKind.Unsupported]: ErrorCode.ENOSYS,
  // [ErrorKind.TooManyLinks]:  ErrorCode.EMLINK,
  // [ErrorKind.FilenameTooLong]:  ErrorCode.ENAMETOOLONG,
  // [ErrorKind.NetworkDown]:  ErrorCode.ENETDOWN,
  // [ErrorKind.NetworkUnreachable]:  ErrorCode.ENETUNREACH,
  [ErrorKind.NotConnected]: ErrorCode.ENOTCONN,
  [ErrorKind.NotADirectory]: ErrorCode.ENOTDIR,
  // [ErrorKind.DirectoryNotEmpty]:  ErrorCode.ENOTEMPTY,
  [ErrorKind.BrokenPipe]: ErrorCode.EPIPE,
  // [ErrorKind.ReadOnlyFilesystem]:  ErrorCode.EROFS,
  // [ErrorKind.NotSeekable]:  ErrorCode.ESPIPE,
  // [ErrorKind.StaleNetworkFileHandle]:  ErrorCode.ESTALE,
  [ErrorKind.TimedOut]: ErrorCode.ETIMEDOUT,
  // [ErrorKind.ExecutableFileBusy]:  ErrorCode.ETXTBSY,
  // [ErrorKind.CrossesDevices]:  ErrorCode.EXDEV,
  [ErrorKind.PermissionDenied]: ErrorCode.EACCES, // NOTE: Collides with EPERM ...
};

/* tslint:disable:variable-name */
/**
 * Strings associated with each error code.
 * @hidden
 */
export const ErrorStrings: { [code: string]: string; [code: number]: string } = {};
ErrorStrings[ErrorCode.EPERM] = 'Operation not permitted.';
ErrorStrings[ErrorCode.ENOENT] = 'No such file or directory.';
ErrorStrings[ErrorCode.EIO] = 'Input/output error.';
ErrorStrings[ErrorCode.EBADF] = 'Bad file descriptor.';
ErrorStrings[ErrorCode.EACCES] = 'Permission denied.';
ErrorStrings[ErrorCode.EBUSY] = 'Resource busy or locked.';
ErrorStrings[ErrorCode.EEXIST] = 'File exists.';
ErrorStrings[ErrorCode.ENOTDIR] = 'File is not a directory.';
ErrorStrings[ErrorCode.EISDIR] = 'File is a directory.';
ErrorStrings[ErrorCode.EINVAL] = 'Invalid argument.';
ErrorStrings[ErrorCode.EFBIG] = 'File is too big.';
ErrorStrings[ErrorCode.ENOSPC] = 'No space left on disk.';
ErrorStrings[ErrorCode.EROFS] = 'Cannot modify a read-only file system.';
ErrorStrings[ErrorCode.ENOTEMPTY] = 'Directory is not empty.';
ErrorStrings[ErrorCode.ENOTSUP] = 'Operation is not supported.';
ErrorStrings[ErrorCode.ESPIPE] = 'Socket dont support this';
/* tslint:enable:variable-name */

/**
 * Represents a BrowserFS error. Passed back to applications after a failed
 * call to the BrowserFS API.
 */
export class ApiError extends Error {
  public static fromJSON(json: any): ApiError {
    const err = new ApiError(0);
    err.errno = json.errno;
    err.code = json.code;
    err.path = json.path;
    err.stack = json.stack;
    err.message = json.message;
    return err;
  }

  /**
   * Creates an ApiError object from a buffer.
   */
  // public static fromBuffer(buffer: Uint8Array, i: number = 0): ApiError {
  //   return ApiError.fromJSON(
  //     JSON.parse(buffer.toString('utf8', i + 4, i + 4 + buffer.readUInt32LE(i))),
  //   );
  // }

  public static FileError(code: ErrorCode, p: string): ApiError {
    return new ApiError(code, ErrorStrings[code], p);
  }

  public static ENOENT(path: string): ApiError {
    return this.FileError(ErrorCode.ENOENT, path);
  }

  public static EEXIST(path: string): ApiError {
    return this.FileError(ErrorCode.EEXIST, path);
  }

  public static EISDIR(path: string): ApiError {
    return this.FileError(ErrorCode.EISDIR, path);
  }

  public static ENOTDIR(path: string): ApiError {
    return this.FileError(ErrorCode.ENOTDIR, path);
  }

  public static EACCES(path: string): ApiError {
    return this.FileError(ErrorCode.EACCES, path);
  }

  public static ENOTEMPTY(path: string): ApiError {
    return this.FileError(ErrorCode.ENOTEMPTY, path);
  }

  public errno: ErrorCode;
  public code: ErrorCode;
  public path: string | undefined;
  // Unsupported.
  public syscall: string = '';
  public stack: string | undefined;

  /**
   * Represents a BrowserFS error. Passed back to applications after a failed
   * call to the BrowserFS API.
   *
   * Error codes mirror those returned by regular Unix file operations, which is
   * what Node returns.
   * @constructor ApiError
   * @param type The type of the error.
   * @param [message] A descriptive error message.
   */
  constructor(type: ErrorCode, message: string = ErrorStrings[type], path?: string) {
    super(message);
    this.code = ErrorCode[type] as unknown as ErrorCode;
    this.errno = type;
    this.path = path;
    this.stack = new Error(`${this.code}: ${message}${this.path ? `, '${this.path}'` : ''}`).stack;
    this.message = `${this.code}: ${message}${this.path ? `, '${this.path}'` : ''}`;
  }

  /**
   * @return A friendly error message.
   */
  public toString(): string {
    return this.message;
  }

  public toJSON(): any {
    return {
      errno: this.errno,
      code: this.code,
      path: this.path,
      stack: this.stack,
      message: this.message,
    };
  }

  /**
   * Writes the API error into a buffer.
   */
  // public writeToBuffer(
  //   data: Uint8Array = new Uint8Array(this.bufferSize()),
  //   i: number = 0,
  // ): Uint8Array {
  //   const buffer = Buffer.from(data);
  //   const bytesWritten = buffer.write(JSON.stringify(this.toJSON()), i + 4);
  //   buffer.writeUInt32LE(bytesWritten, i);
  //   return buffer;
  // }

  /**
   * The size of the API error in buffer-form in bytes.
  //  */
  // public bufferSize(): number {
  //   // 4 bytes for string length.
  //   return 4 + Buffer.byteLength(JSON.stringify(this.toJSON()));
  // }
}
