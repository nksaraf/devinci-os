import { expose, proxy } from '../comlink';
import InMemoryFileSystem from './inmemory';
import { VirtualFileSystem } from './virtual';
import { newPromise } from '../promise';


export class SharedFileSystem extends VirtualFileSystem {
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
    return proxy(await super.open(...args));
  }
}
