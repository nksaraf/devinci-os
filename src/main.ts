import '@ui/css/global.scss';
import 'uno.css';
import MacOS from 'os/ui/OS/OS.svelte';
import { createKernel } from './kernel/kernel';
import { KernelFlags } from './kernel/kernel/types';
import './comlink';
import calculator from 'os/apps/calculator/calculator';
import calendar from 'os/apps/calendar/calendar';
import finder from 'os/apps/finder/finder';
import editor from 'os/apps/editor/editor';
import terminal from 'os/apps/terminal/terminal';
import vscode from 'os/apps/vscode/vscode';
import wallpaper from 'os/apps/wallpaper/wallpaper';
import { createAppConfig, installApp } from './stores/apps.store';
import { setupWorker, rest } from 'msw';
import { Kernel } from './deno/denix';
import DenoWorker from './deno-worker?worker';
import { expose } from 'comlink';
import { constants } from 'os/kernel/kernel/constants';
import { ApiError, ERROR_KIND_TO_CODE } from './kernel/fs/core/api_error';
import { VirtualFileSystem } from './kernel/fs';
import Global from './kernel/global';
let log = console.log;
console.log = function () {
  log('main', ...arguments);
};
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
  Global.fs = denix.fs;
  denix.fs.writeFileSync('/hello.txt', 'Hello World', 'utf-8', constants.fs.O_RDWR, 0x644);
  let w = new DenoWorker();
  expose(denix, w);

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
