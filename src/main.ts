import '@ui/css/global.scss';
import 'uno.css';
import MacOS from 'os/ui/OS/OS.svelte';
import calculator from 'os/apps/calculator/calculator';
import calendar from 'os/apps/calendar/calendar';
import finder from 'os/apps/finder/finder';
import editor from 'os/apps/editor/editor';
import terminal from 'os/apps/terminal/terminal';
import vscode from 'os/apps/vscode/vscode';
import wallpaper from 'os/apps/wallpaper/wallpaper';
import { createAppConfig, installApp } from './stores/apps.store';
import { Kernel } from './deno/denix';
import { constants } from 'os/kernel/kernel/constants';
import Global from './kernel/global';

installApp(finder());
installApp(calculator());
installApp(calendar());
installApp(editor());
installApp(terminal());
installApp(vscode());
installApp(wallpaper());
installApp(
  createAppConfig({
    id: 'workflowy',
    title: 'Workflowy',
    dock: {
      icon: '/assets/app-icons/workflowy/256.png',
      onClick() {
        // @ts-ignore
        window.open('https://workflowy.com/', '_blank');
      },
    },
  }),
);

export const initKernel = async () => {
  console.log(new ReadableStream());
  console.log('booting Kernel');

  // let iframe = document.createElement('iframe');
  // // iframe.src = 'http://localhost:80/listener.html';
  // iframe.src = 'http://localhost:80/kernel.html';
  // iframe.allow = 'cross-origin-isolated';

  // document.body.appendChild(iframe);

  // if ('serviceWorker' in navigator) {
  //   window.addEventListener('load', function() {
  //     navigator.serviceWorker.register('/sw.js').then(function(registration) {
  //       // Registration was successful
  //       console.log('ServiceWorker registration successful with scope: ', registration.scope);
  //     }, function(err) {
  //       // registration failed :(
  //       console.log('ServiceWorker registration failed: ', err);
  //     });
  //   });
  // }

  // let deno = await DenoRuntime.bootstrapInWorker();
  // console.log(deno);

  // await deno.eval(`console.log('herello world')`);

  // worker.resetHandlers();
  // All on main thread:
  // let denoLocal = await DenoRuntime.bootstrapInWorker();
  // await denoLocal.eval(`console.log('herello world')`);
  const denix = await Kernel.create();
  await denix.initNetwork();
  Global.fs = denix.fs;
  denix.fs.writeFileSync('/hello.txt', 'Hello World', 'utf-8', constants.fs.O_RDWR, 0x644);

  // await w1.run('https://deno.land/std@0.115.1/http/file_server.ts');

  // let w2 = wrap<DenoWorker>(new DenoWebWorker());
  // await w1.init();
  // await w1.run('https://deno.land/std@0.115.1/http/file_server.ts');
  // let { connect } = wrap<{ connect: () => Channel }>(w);

  // ui thread
  // let channel = await connect();
  // let channelApi = wrap(channel.portToWrap);
  // expose(denix, channel.portToWrap);
  // console.log(await (await fetch('http://localhost:4507')).text());
  //

  return denix;
};

initKernel()
  .then(() => {})
  .finally(() => {
    new MacOS({
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
