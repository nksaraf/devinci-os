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
import { DenoHost } from './deno/deno-host';
import DenoWorker from './deno-worker?worker';
import { expose } from 'comlink';
import { constants } from 'os/kernel/kernel/constants';

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

  let kernel = await createKernel({
    mode: KernelFlags.PRIVILEGED | KernelFlags.UI | KernelFlags.MAIN,
  });

  const host = new DenoHost();

  kernel.fs.writeFileSync('/hello.txt', 'Hello World', 'utf-8', constants.fs.O_RDWR, 0x644);

  let worker = setupWorker(
    // rest.get('/deno-host', async (req, res, ctx) => {
    //   console.log('/deno-host', req.url);
    //   console.log(JSON.parse(req.body));
    //   return res(
    //     ctx.json({
    //       firstName: 'John',
    //     }),
    //   );
    // }),
    rest.post('/deno/op/sync/:id', async (req, res, ctx) => {
      let id = JSON.parse(req.body as string);
      console.log(host);
      return res(ctx.json(host.ops[req.params.id].sync(id[1], id[2])));
    }),
  );

  console.time('unpacking deno');

  // let deno = await DenoRuntime.bootstrapInWorker();
  // console.log(deno);
  console.timeEnd('unpacking deno');

  // await deno.eval(`console.log('herello world')`);
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      options: {
        scope: 'http://localhost:3000/',
      },
    },
  });

  worker.resetHandlers();
  // All on main thread:
  // let denoLocal = await DenoRuntime.bootstrapInWorker();
  // await denoLocal.eval(`console.log('herello world')`);

  let w = new DenoWorker();
  expose(host, w);

  //

  return kernel;
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
