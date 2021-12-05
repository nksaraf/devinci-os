import 'uno.css';
import '@ui/css/global.scss';

import MacOS from 'os/macos/ui/OS/OS.svelte';
import { addDockItem } from './stores/dock.store';
import { WebView } from './stores/window.store';

addDockItem({
  title: 'Finder',
  appID: 'finder',
  onClick: () => {
    new WebView({
      appID: 'finder',
      title: 'Finder',
      loadComponent: () => import('os/macos/apps/finder/Finder.svelte').then((m) => m.default),
      args: {
        path: '/',
      },
    }).open();
  },
});

addDockItem({
  title: 'Editor',
  appID: 'editor',
  icon: '/assets/app-icons/editor/256.png',
  onClick: () => {
    new WebView({
      appID: 'editor',
      overflow: true,
      title: 'Editor',
      loadComponent: () => import('os/macos/apps/editor/Editor.svelte').then((m) => m.default),
      args: {
        path: '/lib/deno/test_util/std/examples/cat.ts',
      },
      trafficLights: false,
    }).open();
  },
});

addDockItem({
  title: 'Terminal',
  appID: 'terminal',
  icon: '/assets/app-icons/terminal/256.png',
  onClick: () => {
    new WebView({
      appID: 'terminal',
      title: 'Terminal',
      loadComponent: () => import('os/macos/apps/terminal/Terminal.svelte').then((m) => m.default),
      trafficLights: false,
    }).open();
  },
});

// import calculator from 'os/macos/apps/calculator/calculator';
// import calendar from 'os/macos/apps/calendar/calendar';
// import finder from 'os/macos/apps/finder/finder';
// import editor from 'os/macos/apps/editor/editor';
// import terminal from 'os/macos/apps/terminal/terminal';
// import vscode from 'os/macos/apps/vscode/vscode';
// import wallpaper from 'os/macos/apps/wallpaper/wallpaper';
// import { createAppConfig, installApp } from './stores/apps.store';

// installApp(finder());
// installApp(calculator());
// installApp(calendar());
// installApp(editor());
// installApp(terminal());
// installApp(vscode());
// installApp(wallpaper());
// installApp(
//   createAppConfig({
//     id: 'workflowy',
//     title: 'Workflowy',
//     dock: {
//       icon: '/assets/app-icons/workflowy/256.png',
//       onClick() {
//         // @ts-ignore
//         window.open('https://workflowy.com/', '_blank');
//       },
//     },
//   }),
// );
// installApp(
//   createAppConfig({
//     id: 'file_server',
//     title: 'File Server',
//     window: {
//       loadComponent: async () => (await import('os/macos/apps/Demo.svelte')).default,
//       frame: true,
//       trafficLights: true,
//       title: 'File Server',
//     },
//     dock: {
//       icon: '/assets/app-icons/workflowy/256.png',
//     },
//   }),
// );

export function render(target: HTMLElement) {
  new MacOS({
    target: target,
  });
}
