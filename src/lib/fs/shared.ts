import { expose, proxy } from '../comlink/mod';
import InMemoryFileSystem from './inmemory';
import { VirtualFileSystem } from './virtual';
import { newPromise } from '../promise';
import VirtualFile from './core/virtual_file';
import type { File } from './core/file';
import type Stats from './core/stats';

export class SharedFile extends VirtualFile {
  constructor(path: string, flag: number, stats: Stats, public file: File) {
    super(path, flag, stats);
  }

  getConnection() {
    const channel = new MessageChannel();
    channel.port1.start();

    expose(this, channel.port1);

    return channel.port2;
  }

  refs = 0;
  ref() {
    this.refs++;
  }

  public async write(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<number> {
    let num = await this.file.write(buffer, offset, length, position);
    await this.file.sync();
    return num;
  }

  public async close(): Promise<void> {
    this.unref();

    if (this.refs === 0) {
      await this.file.close();
    }
  }

  unref() {
    this.refs--;
  }
}

export class SharedFileSystem extends VirtualFileSystem {
  openedFiles: Record<string, SharedFile> = {};
  constructor() {
    super(new InMemoryFileSystem());
  }

  readyPromise = newPromise();
  async ready() {
    console.log('waitign for ready');
    let res = await this.readyPromise.promise;
    console.log('ready');
    return res;
  }

  async newConnection() {
    await this.ready();
    const channel = new MessageChannel();
    expose(this, channel.port1);
    return channel.port2;
  }

  async open(...args: Parameters<typeof VirtualFileSystem.prototype.open>) {
    if (this.openedFiles[args[0]]) {
      this.openedFiles[args[0]].ref();
      return this.openedFiles[args[0]];
    }

    let file = (await super.open(...args)) as VirtualFile;

    let sharedFile = new SharedFile(file.getPath(), file.getFlag(), file.getStats(), file);
    sharedFile.ref();
    this.openedFiles[args[0]] = sharedFile;
    return sharedFile;
  }
}
