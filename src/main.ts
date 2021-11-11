import '@ui/css/global.scss';
import 'uno.css';
import MacOS from 'os/ui/OS/OS.svelte';
import { createKernel } from './kernel/kernel';
import type { Kernel } from './kernel/kernel';
import { KernelFlags } from './kernel/kernel/types';
import { SocketFile } from './kernel/kernel/net';
import { FileType } from './kernel/fs/core/stats';
import NodeWorker from './node-worker?worker';
import { NodeHost } from './kernel/node/runtime';
import { wrap } from 'comlink';

export const initKernel = async () => {
  console.log(new ReadableStream());
  console.log('booting Kernel');

  let kernel = await createKernel({
    mode: KernelFlags.PRIVILEGED | KernelFlags.UI | KernelFlags.MAIN,
  });
  console.log(kernel);
  await NodeHost.bootstrap(kernel);
  let net = NodeHost.require('net');
  console.log(new net.Socket());

  console.log(kernel.fs.openSync('/hello.txt', 'w+', FileType.FILE));
  // Step 1: Create a server socket
  server(kernel);

  let process = await kernel.proc.addWorker({ args: ['main'], worker: new NodeWorker() });
  await process.run();

  return kernel;
};

function server(kernel: Kernel) {
  const serverSocket = kernel.net.socket();

  // Step 2: Bind the socket to a port
  kernel.net.bind(serverSocket, 'localhost', 4000);

  // Step 3: Start listening for connections
  serverSocket.listen(console.log);

  serverSocket.accept((err, dataSocket) => {
    console.log('accepted connection as', dataSocket);
    const buf = Buffer.from('     ', 'utf-8');
    dataSocket.read(buf, 0, 8048, -1, () => {
      console.log('got data', buf.toString('utf-8'));
    });
  });
}

initKernel();
// initKernel().then((kernel) => {
// console.log(kernel);
const desktop = new MacOS({
  target: document.getElementById('root'),
});
// });
