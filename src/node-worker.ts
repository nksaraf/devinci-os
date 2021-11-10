import { expose } from 'comlink';
import { Kernel } from './kernel/kernel/kernel';
import HttpRequest from './kernel/fs/backend/HTTPRequest';
import { Process } from './kernel/kernel/proc';
import { createFileSystemBackend } from './kernel/fs/create-fs';
import { KernelFlags } from './kernel/kernel/types';
import { NodeHost } from './kernel/node/runtime';

const kernel = new Kernel();
console.log(kernel);

export class NodeWorker extends Process {
  constructor() {
    super({
      name: 'node',
      parent: null,
      id: 'node',
    });
  }
  async boot() {
    await kernel.boot(KernelFlags.USER);
    await NodeHost.bootstrap(kernel);
    console.log('here');
    console.log(NodeHost.require('net'));
  }
}

expose(NodeWorker);
