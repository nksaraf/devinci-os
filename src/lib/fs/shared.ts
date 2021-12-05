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

  public async read(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<number> {
    console.log('read', this.getPath(), offset, length, position);
    let num = await this.file.read(buffer, offset, length, position);
    return num;
  }

  public async write(
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ): Promise<number> {
    let num = await this.file.write(buffer, offset, length, position);
    return num;
  }

  public writeSync(buffer: Uint8Array, offset: number, length: number, position: number): number {
    let num = this.file.writeSync(buffer, offset, length, position);
    return num;
  }

  public async close(): Promise<void> {
    this.unref();
    await this.file.sync();

    if (this.refs === 0) {
      await this.file.close();
    }
  }

  public closeSync(): void {
    this.unref();
    this.file.syncSync();

    if (this.refs === 0) {
      this.file.closeSync();
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

  openSync(...args: Parameters<typeof VirtualFileSystem.prototype.open>) {
    if (this.openedFiles[args[0]]) {
      this.openedFiles[args[0]].ref();
      return this.openedFiles[args[0]];
    }

    let file = super.openSync(...args) as VirtualFile;

    let sharedFile = new SharedFile(file.getPath(), file.getFlag(), file.getStats(), file);
    sharedFile.ref();
    this.openedFiles[args[0]] = sharedFile;
    return sharedFile;
  }
}
