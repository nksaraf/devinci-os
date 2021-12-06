import './lib/deno/deno';
import 'uno.css';
import '@ui/css/global.scss';
import { render } from './macos/boot_macos';
import { wrap } from './lib/comlink/mod';

let worker = wrap(
  new Worker(new URL('./lib/vite.ts?worker_file', import.meta.url).href, {
    type: 'module',
  }),
);

await worker.run();

console.log('🦕 Deno is ready', Deno.version);
console.log('🍎 MacOS booting');

render(document.getElementById('root'));
