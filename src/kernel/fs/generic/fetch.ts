/**
 * Contains utility methods using 'fetch'.
 */

import { ApiError, ErrorCode } from '../core/api_error';
import { Buffer } from 'buffer';
export const fetchIsAvailable = typeof fetch !== 'undefined' && fetch !== null;

/**
 * Asynchronously download a file as a buffer or a JSON object.
 * Note that the third function signature with a non-specialized type is
 * invalid, but TypeScript requires it when you specialize string arguments to
 * constants.
 * @hidden
 */
export function fetchFileAsync(p: string, type: 'buffer'): Promise<Buffer>;
export function fetchFileAsync(p: string, type: 'json'): Promise<any>;
export function fetchFileAsync(p: string, type: string): Promise<any>;
export async function fetchFileAsync(p: string, type: string): Promise<any> {
  let res = await fetch(p);

  if (!res.ok) {
    throw new ApiError(ErrorCode.EIO, `fetch error: response returned code ${res.status}`);
  }
  switch (type) {
    case 'buffer':
      return Buffer.from(await res.arrayBuffer());
      break;
    case 'json':
      return await res.json();
      break;
    default:
      throw new ApiError(ErrorCode.EINVAL, 'Invalid download type: ' + type);
  }
}

/**
 * Asynchronously retrieves the size of the given file in bytes.
 * @hidden
 */
export async function fetchFileSizeAsync(p: string): Promise<number> {
  let res = await fetch(p, { method: 'HEAD' });
  if (!res.ok) {
    throw new ApiError(ErrorCode.EIO, `fetch HEAD error: response returned code ${res.status}`);
  } else {
    return parseInt(res.headers.get('Content-Length') || '-1', 10);
  }
}
