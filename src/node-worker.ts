import { expose } from 'comlink';
import { Kernel } from './kernel/kernel/kernel';
import { KernelFlags } from './kernel/kernel/types';
import { NodeRuntime } from './kernel/node/runtime';

const kernel = new Kernel();
console.log(kernel);

async function boot() {
  await kernel.boot({ mode: KernelFlags.WORKER });
  kernel.proc.listProcesses();
  await NodeRuntime.bootstrap(kernel);
  console.log(NodeRuntime.require('net'));
}

export async function main() {
  await boot();
  const clientSocket = kernel.net.socket();
  clientSocket.connect('localhost', 4000, (err) => {
    if (!err) {
      console.log('looks like we connected');
      // clientSocket.write(Buffer.from('hello', 'utf-8'), 0, 0, -1, console.log);
    } else {
      console.error(err);
    }
  });
}

expose({ main });
