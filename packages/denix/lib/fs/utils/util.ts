/**
 * Grab bag of utility functions used across the code.
 */
import type { IFileSystem } from '../core/file_system.ts';
import { ErrorCode, ApiError } from '../../error.ts';
import * as path from 'path-browserify';
import { Buffer } from 'buffer';

export function deprecationMessage(print: boolean, fsName: string, opts: any): void {
  if (print) {
    // tslint:disable-next-line:no-console
    console.warn(
      `[${fsName}] Direct file system constructor usage is deprecated for this file system, and will be removed in the next major version. Please use the '${fsName}.Create(${JSON.stringify(
        opts,
      )}, callback)' method instead. See https://github.com/jvilk/BrowserFS/issues/176 for more details.`,
    );
    // tslint:enable-next-line:no-console
  }
}

declare global {
  interface Navigator {
    userAgent: string;
  }
}

/**
 * Checks for any IE version, including IE11 which removed MSIE from the
 * userAgent string.
 * @hidden
 */
export const isIE: boolean =
  typeof navigator !== 'undefined' &&
  !!(
    /(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase()) ||
    navigator.userAgent.indexOf('Trident') !== -1
  );

/**
 * Check if we're in a web worker.
 * @hidden
 */
export const isWebWorker: boolean = typeof window === 'undefined';

/**
 * @hidden
 */
export interface Arrayish<T> {
  [idx: number]: T;
  length: number;
}

/**
 * Throws an exception. Called on code paths that should be impossible.
 * @hidden
 */
export function fail() {
  throw new Error('BFS has reached an impossible code path; please file a bug.');
}

/**
 * Synchronous recursive makedir.
 * @hidden
 */
export function mkdirpSync(p: string, mode: number, fs: IFileSystem): void {
  if (!fs.existsSync(p)) {
    mkdirpSync(path.dirname(p), mode, fs);
    fs.mkdirSync(p, mode);
  }
}

/**
 * Synchronous recursive makedir.
 * @hidden
 */
export async function mkdirp(p: string, mode: number, fs: IFileSystem): Promise<void> {
  if (!(await fs.exists(p))) {
    await mkdirp(path.dirname(p), mode, fs);
    await fs.mkdir(p, mode);
  }
}

/**
 * Converts a buffer into an array buffer. Attempts to do so in a
 * zero-copy manner, e.g. the array references the same memory.
 * @hidden
 */
export function buffer2ArrayBuffer(buff: Buffer): ArrayBuffer | SharedArrayBuffer {
  const u8 = buffer2Uint8array(buff),
    u8offset = u8.byteOffset,
    u8Len = u8.byteLength;
  if (u8offset === 0 && u8Len === u8.buffer.byteLength) {
    return u8.buffer;
  } else {
    return u8.buffer.slice(u8offset, u8offset + u8Len);
  }
}

/**
 * Converts a buffer into a Uint8Array. Attempts to do so in a
 * zero-copy manner, e.g. the array references the same memory.
 * @hidden
 */
export function buffer2Uint8array(buff: Buffer): Uint8Array {
  if (buff instanceof Uint8Array) {
    // BFS & Node v4.0 buffers *are* Uint8Arrays.
    return <any>buff;
  } else {
    // Uint8Arrays can be constructed from arrayish numbers.
    // At this point, we assume this isn't a BFS array.
    return new Uint8Array(buff);
  }
}

/**
 * Converts the given arrayish object into a Buffer. Attempts to
 * be zero-copy.
 * @hidden
 */
export function iarrayish2Buffer(arr: Arrayish<number>): Uint8Array {
  if (arr instanceof Buffer) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return uint8Array2Buffer(arr);
  } else {
    return Buffer.from(<number[]>arr);
  }
}

/**
 * Converts the given Uint8Array into a Buffer. Attempts to be zero-copy.
 * @hidden
 */
export function uint8Array2Buffer(u8: Uint8Array): Uint8Array {
  if (u8 instanceof Buffer) {
    return u8;
  } else if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
    return arrayBuffer2Buffer(u8.buffer);
  } else {
    return Buffer.from(<ArrayBuffer>u8.buffer, u8.byteOffset, u8.byteLength);
  }
}

/**
 * Converts the given array buffer into a Buffer. Attempts to be
 * zero-copy.
 * @hidden
 */
export function arrayBuffer2Buffer(ab: ArrayBuffer | SharedArrayBuffer): Uint8Array {
  return Buffer.from(<ArrayBuffer>ab);
}

/**
 * Copies a slice of the given buffer
 * @hidden
 */
export function copyingSlice(buff: Uint8Array, start: number = 0, end = buff.length): Uint8Array {
  if (start < 0 || end < 0 || end > buff.length || start > end) {
    throw new TypeError(
      `Invalid slice bounds on buffer of length ${buff.length}: [${start}, ${end}]`,
    );
  }
  if (buff.length === 0) {
    // Avoid s0 corner case in ArrayBuffer case.
    return emptyBuffer();
  } else {
    const u8 = buff,
      s0 = buff[0],
      newS0 = (s0 + 1) % 0xff;

    buff[0] = newS0;
    if (u8[0] === newS0) {
      // Same memory. Revert & copy.
      u8[0] = s0;
      return uint8Array2Buffer(u8.slice(start, end));
    } else {
      // Revert.
      buff[0] = s0;
      return uint8Array2Buffer(u8.subarray(start, end));
    }
  }
}

/**
 * @hidden
 */
let emptyBuff: Uint8Array | null = null;
/**
 * Returns an empty buffer.
 * @hidden
 */
export function emptyBuffer(): Uint8Array {
  if (emptyBuff) {
    return emptyBuff;
  }
  return (emptyBuff = new Uint8Array(0));
}

/**
 * Option validator for a Buffer file system option.
 * @hidden
 */
export async function bufferValidator(v: object): Promise<void> {
  if (v instanceof Uint8Array) {
    return;
  } else {
    throw new ApiError(ErrorCode.EINVAL, `option must be a Buffer.`);
  }
}
