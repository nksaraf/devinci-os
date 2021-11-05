import { createAppConfig } from 'os/stores/apps.store';

export default () =>
  createAppConfig({
    title: 'Finder',
    id: 'finder',
    dock: {},
    window: {
      loadComponent: async () => (await import('./Finder.svelte')).default,
    },
  });
