import '@ui/css/global.scss';
import 'uno.css';
import { Kernel } from './kernel';
import Global from './kernel/global';
import MacOS from 'os/ui/OS/OS.svelte';
import type { Remote } from 'comlink';

export const createKernel = async (): Promise<Remote<Kernel>> => {
  console.log('booting Kernel');
  let kernel = await new Kernel();
  console.log(' heree booting Kernel');

  await kernel.boot();
  Global.Kernel = kernel;
  return kernel;
};

createKernel()
  .then((kernel) => {
    console.log(kernel);
    const desktop = new MacOS({
      target: document.getElementById('root'),
      props: {
        kernel: {},
      },
    });
  })
  .catch(console.error);
