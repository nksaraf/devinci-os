/**
 * Contains utility methods using 'fetch'.
 */

import { ApiError, ErrorCode } from '../core/api_error';
import type { CallbackTwoArgs } from '../core/file_system';
import { Buffer } from 'buffer';
export const fetchIsAvailable = typeof fetch !== 'undefined' && fetch !== null;

/**
 * Asynchronously download a file as a buffer or a JSON object.
 * Note that the third function signature with a non-specialized type is
 * invalid, but TypeScript requires it when you specialize string arguments to
 * constants.
 * @hidden
 */
export function fetchFileAsync(p: string, type: 'buffer', cb: CallbackTwoArgs<Buffer>): void;
export function fetchFileAsync(p: string, type: 'json', cb: CallbackTwoArgs<any>): void;
export function fetchFileAsync(p: string, type: string, cb: CallbackTwoArgs<any>): void;
export function fetchFileAsync(p: string, type: string, cb: CallbackTwoArgs<any>): void {
  let request;
  try {
    request = fetch(p);
  } catch (e) {
    // XXX: fetch will throw a TypeError if the URL has credentials in it
    return cb(new ApiError(ErrorCode.EINVAL, e.message));
  }
  request
    .then((res) => {
      if (!res.ok) {
        return cb(new ApiError(ErrorCode.EIO, `fetch error: response returned code ${res.status}`));
      } else {
        switch (type) {
          case 'buffer':
            res
              .arrayBuffer()
              .then((buf) => cb(null, Buffer.from(buf)))
              .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
            break;
          case 'json':
            res
              .json()
              .then((json) => cb(null, json))
              .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
            break;
          default:
            cb(new ApiError(ErrorCode.EINVAL, 'Invalid download type: ' + type));
        }
      }
    })
    .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
}

/**
 * Asynchronously retrieves the size of the given file in bytes.
 * @hidden
 */
export function fetchFileSizeAsync(p: string, cb: CallbackTwoArgs<number>): void {
  fetch(p, { method: 'HEAD' })
    .then((res) => {
      if (!res.ok) {
        return cb(
          new ApiError(ErrorCode.EIO, `fetch HEAD error: response returned code ${res.status}`),
        );
      } else {
        return cb(null, parseInt(res.headers.get('Content-Length') || '-1', 10));
      }
    })
    .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
}
