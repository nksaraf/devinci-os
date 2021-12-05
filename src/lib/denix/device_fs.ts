import InMemoryFileSystem from '../fs/inmemory';
import type { File } from '../fs/core/file';
import { TTY } from '../tty/tty';
import { ApiError } from '../error';
import Stats, { FileType } from '../fs/core/stats';

export class DeviceFileSystem extends InMemoryFileSystem {
  constructor() {
    super();
  }

  openedFiles = new Map<string, File>();

  public async readdir(p: string): Promise<string[]> {
    if (p === '/') {
      return [...this.openedFiles.keys()].map((p) => p.slice(1));
    }
  }

  async stat(p: string) {
    if (this.openedFiles.has(p)) {
      return (this.openedFiles.get(p) as TTY).getStats();
    }

    if (p === '/') return new Stats(FileType.DIRECTORY, 1);

    throw ApiError.ENOENT(p);
  }

  public async createFile(p: string, flag: number, mode: number): Promise<File> {
    let tty = new TTY('/dev' + p);
    this.openedFiles.set(p, tty);
    return tty;
  }

  public async open(p: string, flag: number, mode: number): Promise<File> {
    console.log('open', p, flag, mode);
    if (this.openedFiles.has(p)) {
      return this.openedFiles.get(p);
    }

    return await this.createFile(p, flag, mode);
  }
}
