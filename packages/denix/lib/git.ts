// import './node/main';
import git from 'isomorphic-git.ts';
import type { PromiseFsClient } from 'isomorphic-git.ts';
import http from 'isomorphic-git/http/web.ts';
import type { HttpClient } from 'isomorphic-git/http/web.ts';

export function withGitConfig<T>(data: Partial<T>): T & {
  http: HttpClient;
  corsProxy: string;
} {
  return {
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
