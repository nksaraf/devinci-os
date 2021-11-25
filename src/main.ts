import 'uno.css';
import '@ui/css/global.scss';
import MacOS from 'os/ui/OS/OS.svelte';
import calculator from 'os/apps/calculator/calculator';
import calendar from 'os/apps/calendar/calendar';
import finder from 'os/apps/finder/finder';
import editor from 'os/apps/editor/editor';
import terminal from 'os/apps/terminal/terminal';
import vscode from 'os/apps/vscode/vscode';
import wallpaper from 'os/apps/wallpaper/wallpaper';
import { createAppConfig, installApp } from './stores/apps.store';
import { Kernel, ServiceWorker } from './deno/denix/denix';
import { constants } from 'os/kernel/kernel/constants';
import Global from './kernel/global';
import { Network } from './deno/denix/network';
import { rest } from 'msw';
import TranspileWorker from './transpiler?worker';
import { wrap } from './deno/comlink';

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

  const denix = await Kernel.create();
  await Network.connect();
  createLocalNetwork();

  // Network.handle('http://localhost/src/*', async (request) => {});

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

function createLocalNetwork() {
  const transpiler = wrap<{ transpile(data: ArrayBuffer | ReadableStream): string }>(
    new TranspileWorker(),
  );

  Network.worker.use(
    rest.get('https://deno.land/std*', async (req, res, ctx) => {
      const orig = await ctx.fetch(req);
      let data = await transpiler.transpile(orig.body);
      return res(ctx.body(data), ctx.set('Content-Type', 'application/javascript'));
    }),
  );
}
// initKernel().then((kernel) => {
// console.log(kernel);
// const desktop = new MacOS({
//   target: document.getElementById('root'),
// });
// // });
