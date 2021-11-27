import { VirtualFileSystem } from 'os/kernel/fs';
import InMemoryFileSystem from 'os/kernel/fs/backend/InMemory';
import path from 'path-browserify';
import { expose, proxy } from '../comlink';
import { mountDenoLib } from '../deno';
import { newPromise } from '../util';

export class ExposedFileSystem extends VirtualFileSystem {
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

  readDir(item: string) {
    let items = this.readdirSync(item).map((p) => {
      const stat = this.statSync(path.join(item, p), false);
      return {
        name: p,
        isFile: stat.isFile,
        isDirectory: stat.isDirectory,
        isSymbolicLink: stat.isSymbolicLink,
      };
    });
    return items;
  }

  async open(...args) {
    return proxy(await super.open(...args));
  }
}

declare global {
  interface Window {
    onconnect: (e: MessageEvent) => void;
  }
}

const fs = new ExposedFileSystem();

mountDenoLib(fs).then((e) => {
  console.log(e);

  fs.readdir('/lib/deno/core').then(console.log);
  fs.readyPromise.resolve('');
});

expose(fs);
