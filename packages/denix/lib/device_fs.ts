import InMemoryFileSystem from './fs/inmemory.ts';
import type { File } from './fs/core/file.ts';
import { TTY } from './tty/tty.ts';
import { ApiError } from './error.ts';
import Stats, { FileType } from './fs/core/stats.ts';

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
    if (p.slice(1).startsWith('tty')) {
      let tty = new TTY('/dev' + p);

      this.openedFiles.set(p, tty);
      return tty;
    } else if (p.slice(1).startsWith('pty')) {
      let tty = new TTY('/dev' + p);

      this.openedFiles.set(p, tty);
      return tty;
    }
  }

  public async open(p: string, flag: number, mode: number): Promise<File> {
    console.debug('open', p, flag, mode);
    if (this.openedFiles.has(p)) {
      return this.openedFiles.get(p);
    }

    return await this.createFile(p, flag, mode);
  }
}
