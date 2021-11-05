import '@ui/css/global.scss';
import 'uno.css';
import OS from 'os/ui/OS/OS.svelte';

const desktop = new OS({
  target: document.getElementById('root'),
});

export default desktop;
