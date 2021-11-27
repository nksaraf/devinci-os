import './lib/deno/window';
import 'uno.css';
import '@ui/css/global.scss';
import { render } from './macos';

console.log('🦕 Deno is ready', Deno.version);
console.log('🍎 MacOS booting');

render(document.getElementById('root'));
