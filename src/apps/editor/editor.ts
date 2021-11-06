import { createAppConfig } from '__/stores/apps.store';
import { createWindowConfig } from '__/stores/window.store';

export default () =>
  createAppConfig({
    id: 'vscode',
    title: 'Editor',
    window: () => {
      return createWindowConfig({
        trafficLights: false,
        title: '/home',
        args: {
          path: '/home/index.js',
        },
        loadComponent: async () => (await import('./Editor.svelte')).default,
      });
    },
    dock: {},
  });
