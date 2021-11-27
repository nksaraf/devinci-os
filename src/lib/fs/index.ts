import type { IFileSystem } from './core/file_system';
import InMemoryFileSystem from './inmemory';
import { VirtualFileSystem } from './virtual';

export let fs = new VirtualFileSystem(new InMemoryFileSystem());

export function configure(config: { rootFS: IFileSystem }) {
  fs.rootFS = config.rootFS;
}
