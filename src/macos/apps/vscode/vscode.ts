import { createAppConfig } from '__/stores/apps.store';
import { createWebViewConfig } from '__/stores/window.store';

export default () =>
  createAppConfig({
    id: 'vscode',
    title: 'VSCode',
    window: () => {
      return createWebViewConfig({
        trafficLights: false,
        title: '/home',
        args: {
          path: '/home/index.js',
        },
        loadComponent: async () => (await import('./VSCode.svelte')).default,
      });
    },
    dock: {},
  });
