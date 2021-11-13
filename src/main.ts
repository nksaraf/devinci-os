import '@ui/css/global.scss';
import 'uno.css';
import MacOS from 'os/ui/OS/OS.svelte';
import { createKernel } from './kernel/kernel';
import type { Kernel } from './kernel/kernel';
import { KernelFlags } from './kernel/kernel/types';
import { FileType } from './kernel/fs/core/stats';
import { NodeHost } from './kernel/node/runtime';
import { extractContents } from './kernel/kernel/tar';

import calculator from 'os/apps/calculator/calculator';
import calendar from 'os/apps/calendar/calendar';
import finder from 'os/apps/finder/finder';
import editor from 'os/apps/editor/editor';
import terminal from 'os/apps/terminal/terminal';
import vscode from 'os/apps/vscode/vscode';
import wallpaper from 'os/apps/wallpaper/wallpaper';
import { installApp } from './stores/apps.store';

installApp(finder());
installApp(calculator());
installApp(calendar());
installApp(editor());
installApp(terminal());
installApp(vscode());
installApp(wallpaper());

export const initKernel = async () => {
  console.log(new ReadableStream());
  console.log('booting Kernel');

  let kernel = await createKernel({
    mode: KernelFlags.PRIVILEGED | KernelFlags.UI | KernelFlags.MAIN,
  });

  console.log(kernel);
  // console.time('unpacking node');
  // let res = await fetch('/node-lib.tar');
  // let buffer = await res.arrayBuffer();
  // await extractContents(kernel.fs, new Uint8Array(buffer), '/@node');
  // const node = new NodeHost();
  // await node.bootstrap(kernel, '/@node');
  // console.timeEnd('unpacking node');

  console.time('unpacking node');
  // let res = await fetch('/node-lib.tar');
  // let buffer = await res.arrayBuffer();
  // await extractContents(kernel.fs, new Uint8Array(buffer), '/@node');
  const node = new NodeHost();
  await node.bootstrapFromHttp(kernel);
  console.timeEnd('unpacking node');

  let net = node.require('net');
  console.log(new net.Socket());

  console.log(kernel.fs.openSync('/hello.txt', 'w+', FileType.FILE));
  // Step 1: Create a server socket
  server(kernel);

  // await process.run();

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

initKernel()
  .then(() => {})
  .finally(() => {
    const desktop = new MacOS({
      target: document.getElementById('root'),
    });
    // createVSCode(document.getElementById('root'), {});
  });

// initKernel().then((kernel) => {
// console.log(kernel);
// const desktop = new MacOS({
//   target: document.getElementById('root'),
// });
// // });
