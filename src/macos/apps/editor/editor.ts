import { createAppConfig } from '__/stores/apps.store';
import { createWebViewConfig } from '__/stores/window.store';

export default () =>
  createAppConfig({
    id: 'editor',
    title: 'Editor',

    window: () => {
      return createWebViewConfig({
        trafficLights: false,
        title: '/home',
        args: {
          path: '/home/index.js',
        },
        loadComponent: async () => (await import('./Editor.svelte')).default,
      });
    },
    dock: {
      icon: '/assets/app-icons/editor/256.png',
    },
  });
