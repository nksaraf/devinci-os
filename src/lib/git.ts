import git from 'isomorphic-git';
import type { PromiseFsClient } from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import type { HttpClient } from 'isomorphic-git/http/web';
import fs from 'os/lib/fs';
import { Buffer } from 'buffer';

window.Buffer = Buffer;

export function withGitConfig<T>(data: Partial<T>): T & {
  fs: PromiseFsClient;
  http: HttpClient;
  corsProxy: string;
} {
  return {
    fs,
    http,
    corsProxy: 'https://cors.isomorphic-git.org',
    ...data,
  } as unknown as T & {
    fs: PromiseFsClient;
    http: HttpClient;
    corsProxy: string;
  };
}

export { git };
export default git;
