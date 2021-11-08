import '@ui/css/global.scss';
import 'uno.css';
import OS from 'os/ui/OS/OS.svelte';
import { Kernel } from './lib/kernel';



export const createKernel = (): Kernel => {
    const kernel = new Kernel();
    kernel.start();
    return kernel;
};

const desktop = new OS({
  target: document.getElementById('root'),
});

export default desktop;
