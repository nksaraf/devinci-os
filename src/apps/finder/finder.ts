import { createAppConfig } from 'os/stores/apps.store';

export default () =>
  createAppConfig({
    title: 'Finder',
    id: 'finder',
    dock: {},
    window: {
      width: 720,
      height: 540,
      loadComponent: async () => (await import('./Finder.svelte')).default,
    },
  });
