import { deno, Deno } from './deno';
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
installApp(
  createAppConfig({
    id: 'file_server',
    title: 'File Server',
    window: {
      loadComponent: async () => (await import('os/apps/Demo.svelte')).default,
      frame: true,
      trafficLights: true,
      title: 'File Server',
    },
    dock: {
      icon: '/assets/app-icons/workflowy/256.png',
    },
  }),
);

console.log('🦕 Deno is ready!', Deno.version);

console.log(JSON.parse(await (await deno.context.fetch('file:///lib/deno/index.json')).text()));

function render(target: HTMLElement) {
  new MacOS({
    target: target,
  });
}

render(document.getElementById('root'));
