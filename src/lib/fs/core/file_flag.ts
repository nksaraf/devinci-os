import { checkFlag } from "os/lib/bit";
import { constants } from "os/lib/constants";

export enum ActionType {
  // Indicates that the code should not do anything.
  NOP = 0,
  // Indicates that the code should throw an exception.
  THROW_EXCEPTION = 1,
  // Indicates that the code should truncate the file, but only if it is a file.
  TRUNCATE_FILE = 2,
  // Indicates that the code should create the file.
  CREATE_FILE = 3,
}

/**
 * Represents one of the following file flags. A convenience object.
 *
 * * `'r'` - Open file for reading. An exception occurs if the file does not exist.
 * * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
 * * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
 * * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
 * * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
 * * `'wx'` - Like 'w' but opens the file in exclusive mode.
 * * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
 * * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
 * * `'a'` - Open file for appending. The file is created if it does not exist.
 * * `'ax'` - Like 'a' but opens the file in exclusive mode.
 * * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
 * * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
 *
 * Exclusive mode ensures that the file path is newly created.
 */
// export type FileFlag = {} string;

// export class FileFlagString {
//   // Contains cached FileMode instances.
//   private static flagCache: { [mode: string]: FileFlagString } = {};
//   // Array of valid mode strings.
//   private static validFlagStrs = [
//     'r',
//     'r+',
//     'rs',
//     'rs+',
//     'w',
//     'wx',
//     'w+',
//     'wx+',
//     'a',
//     'ax',
//     'a+',
//     'ax+',
//   ];

//   /**
//    * Get an object representing the given file flag.
//    * @param modeStr The string representing the flag
//    * @return The FileFlag object representing the flag
//    * @throw when the flag string is invalid
//    */
//   public static getFileFlag(flagStr: string): FileFlagString {
//     // Check cache first.
//     if (FileFlagString.flagCache.hasOwnProperty(flagStr)) {
//       return FileFlagString.flagCache[flagStr];
//     }
//     return (FileFlagString.flagCache[flagStr] = new FileFlagString(flagStr));
//   }

//   private flagStr: string;
//   /**
//    * This should never be called directly.
//    * @param modeStr The string representing the mode
//    * @throw when the mode string is invalid
//    */
//   constructor(flagStr: string) {
//     flags = flagStr;
//     if (FileFlagString.validFlagStrs.indexOf(flagStr) < 0) {
//       throw new ApiError(ErrorCode.EINVAL, 'Invalid flag: ' + flagStr);
//     }
//   }

//   /**
//    * Get the underlying flag string for this flag.
//    */
// export function getFlagString(flags: FileFlagString): string {
//   return flags;
// }

const any = (flag: number, val: number) => {
  return (flag & val) > 0;
};

const equal = (flag: number, val: number) => {
  return (flag & val) === val;
};

/**
 * Returns true if the file is readable.
 */
export function isReadable(flags: FileFlagString): boolean {
  return equal(flags, constants.fs.O_RDWR) || equal(flags, constants.fs.O_RDONLY);
}
/**
 * Returns true if the file is writeable.
 */
export function isWriteable(flags: FileFlagString): boolean {
  return any(flags, constants.fs.O_WRONLY | constants.fs.O_RDWR);
}
/**
 * Returns true if the file mode should truncate.
 */
export function isTruncating(flags: FileFlagString): boolean {
  return any(flags, constants.fs.O_WRONLY);
}
/**
 * Returns true if the file is appendable.
 */
export function isAppendable(flags: FileFlagString): boolean {
  return any(flags, constants.fs.O_APPEND);
}
/**
 * Returns true if the file is open in synchronous mode.
 */
export function isSynchronous(flags: FileFlagString): boolean {
  return checkFlag(flags, constants.fs.O_SYNC);
}
/**
 * Returns true if the file is open in exclusive mode.
 */
export function isExclusive(flags: FileFlagString): boolean {
  return checkFlag(flags, constants.fs.O_EXCL);
}

/**
 * Returns one of the static fields on this object that indicates the
 * appropriate response to the path existing.
 */
export function pathExistsAction(flags: FileFlagString): ActionType {
  if (isExclusive(flags)) {
    return ActionType.THROW_EXCEPTION;
  } else if (isTruncating(flags)) {
    return ActionType.TRUNCATE_FILE;
  } else {
    return ActionType.NOP;
  }
}
/**
 * Returns one of the static fields on this object that indicates the
 * appropriate response to the path not existing.
 */
export function pathNotExistsAction(flags: FileFlagString): ActionType {
  if (isWriteable(flags) || isAppendable(flags) || any(flags, constants.fs.O_CREAT)) {
    return ActionType.CREATE_FILE;
  } else {
    return ActionType.THROW_EXCEPTION;
  }
}
// }

export type FileFlagString = number;

export type FileFlag =
  | 'r'
  | 'r+'
  | 'rs'
  | 'rs+'
  | 'w'
  | 'wx'
  | 'w+'
  | 'wx+'
  | 'a'
  | 'ax'
  | 'a+'
  | 'ax+';
