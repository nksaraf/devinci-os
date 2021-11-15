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
import Global from './kernel/global';
import { runTests } from './runTests';
import { constants } from './kernel/kernel/constants';

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
  Global.node = node;
  console.timeEnd('unpacking node');

  let net = node.require('net');
  console.log(new net.Socket());

  console.log(kernel.fs.openSync('/hello.txt', constants.fs.O_RDWR, FileType.FILE));
  // Step 1: Create a server socket
  server(kernel);

  node.require('child_process').spawnSync('/bin/sh', ['-c', 'echo hello']);
  node.require('os');
  // node.setInternalModule('bench-common', {
  //   createBenchmark: () => {
  //     let id = 0;
  //     return {
  //       start: () => {
  //         console.log('starting');
  //         console.time(`${id}`);
  //       },
  //       end: () => {
  //         console.timeEnd('id');
  //       },
  //     };
  //   },
  // });

  runTests(node);

  // node
  //   .require('net')
  //   .createServer({}, function (socket) {
  //     console.log('client connected', socket);
  //     // Send the HTTP header
  //     // HTTP Status: 200 : OK
  //     // Content Type: text/plain
  //     // response.writeHead(200, { 'Content-Type': 'text/plain' });

  //     // // Send the response body as "Helo World"
  //     // response.end('Hello World\n');

  //     socket.write('Echo server\r\n');
  //     socket.pipe(socket);
  //   })
  //   .listen(8081);

  // Console will print the message
  // console.log('Server running at http://127.0.0.1:8081/');

  // setTimeout(() => {
  //   var net = node.require('net');

  //   var client = new net.Socket();
  //   client.connect(1337, '127.0.0.1', function () {
  //     console.log('Connected');
  //     client.write('Hello, server! Love, Client.');
  //   });

  //   client.on('data', function (data) {
  //     console.log('Received: ' + data);
  //     client.destroy(); // kill client after server's response
  //   });

  //   client.on('close', function () {
  //     console.log('Connection closed');
  //   });
  // }, 500);
  // await process.run();

  return kernel;
};

function server(kernel: Kernel) {
  // const serverSocket = kernel.net.socket();
  // // Step 2: Bind the socket to a port
  // kernel.net.bind(serverSocket, 'localhost', 4000);
  // // Step 3: Start listening for connections
  // serverSocket.listen(console.log);
  // serverSocket.accept((err, dataSocket) => {
  //   console.log('accepted connection as', dataSocket);
  //   const buf = Buffer.from('     ', 'utf-8');
  //   dataSocket.read(buf, 0, 8048, -1, () => {
  //     console.log('got data', buf.toString('utf-8'));
  //   });
  // });
}

initKernel()
  .then(() => {})
  .finally(() => {
    // const desktop = new MacOS({
    //   target: document.getElementById('root'),
    // });
    // createVSCode(document.getElementById('root'), {});
  });

// initKernel().then((kernel) => {
// console.log(kernel);
// const desktop = new MacOS({
//   target: document.getElementById('root'),
// });
// // });
