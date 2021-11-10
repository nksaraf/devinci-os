import '@ui/css/global.scss';
import 'uno.css';
import MacOS from 'os/ui/OS/OS.svelte';
import { createKernel } from './kernel/kernel';
import { KernelContext, KernelFlags } from './kernel/kernel/types';
import { SocketFile } from './kernel/kernel/net';
import { FileType } from './kernel/fs/core/stats';
import NodeWorker from './node-worker?worker';
import { NodeHost } from './kernel/node/runtime';
import { wrap } from 'comlink';

export const initKernel = async () => {
  console.log(new ReadableStream());
  console.log('booting Kernel');
  let kernel = await createKernel(KernelFlags.PRIVILEGED | KernelFlags.UI);
  console.log(kernel);
  await NodeHost.bootstrap(kernel);
  let net = NodeHost.require('net');
  let http = NodeHost.require('http');
  console.log(new net.Socket());
  let Node = wrap(new NodeWorker());
  const node = await new Node();
  console.log(await node.boot());

  console.log(kernel.fs.openSync('/hello.txt', 'w+', FileType.FILE));
  // Step 1: Create a server socket
  const serverSocket = kernel.net.socket();

  // Step 2: Bind the socket to a port
  kernel.net.bind(serverSocket, 'localhost', 4000);

  // Step 3: Start listening for connections
  serverSocket.listen(console.log);

  serverSocket.accept((err, dataSocket) => {
    console.log('accepted connection as', dataSocket);
    console.log(clientSocket, dataSocket);
    const buf = Buffer.from('     ', 'utf-8');
    dataSocket.read(buf, 0, 8048, -1, () => {
      console.log('got data', buf.toString('utf-8'));
    });
  });

  const clientSocket = new SocketFile(kernel.proc.processes[0]);
  clientSocket.connect('localhost', 4000, (err) => {
    clientSocket.write(Buffer.from('hello', 'utf-8'), 0, 0, -1, console.log);
  });

  return kernel;
};

function server() {}

function client() {}

initKernel();
// initKernel().then((kernel) => {
// console.log(kernel);
const desktop = new MacOS({
  target: document.getElementById('root'),
});
// });
