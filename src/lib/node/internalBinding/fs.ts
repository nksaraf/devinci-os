class FSReqCallback<ResultType = unknown> {
  constructor(bigint?: boolean) {}
  oncomplete: ((error: Error) => void) | ((error: null, result: ResultType) => void);
  context: ReadFileContext;
}

import { isString } from '@antfu/utils';
import { constants } from '../constants';
import fs from '../fs';

interface ReadFileContext {
  fd: number | undefined;
  isUserFd: boolean | undefined;
  size: number;
  callback: (err?: Error, data?: string | Buffer) => unknown;
  buffers: Buffer[];
  buffer: Buffer;
  pos: number;
  encoding: string;
  err: Error | null;
  signal: unknown /* AbortSignal | undefined */;
}

interface FSSyncContext {
  fd?: number;
  path?: string;
  dest?: string;
  errno?: string;
  message?: string;
  syscall?: string;
  error?: Error;
}

type BufferType = Uint8Array;
type Stream = object;
type StringOrBuffer = string | BufferType;

export const kUsePromises: unique symbol = Symbol('usePromises');

export function open(
  path: StringOrBuffer,
  flags: number,
  mode: number,
  req: FSReqCallback<number>,
): void;
export function open(
  path: StringOrBuffer,
  flags: number,
  mode: number,
  req?: FSReqCallback<number>,
  ctx?: FSSyncContext,
): number {
  if (isString(path)) {
  } else {
    path = Buffer.from(path).toString('utf-8');
  }
  if (typeof req === 'undefined') {
    try {
      return fs.openSync(
        path,
        {
          [constants.fs.O_RDONLY]: 'r' as const,
          [constants.fs.O_RDWR]: 'r+' as const,
        }[flags],
        mode,
      );
    } catch (e) {
      console.log(e);
    }
  } else {
  }
}
