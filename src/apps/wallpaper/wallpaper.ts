import { createAppConfig } from 'os/stores/apps.store';

export default () =>
  createAppConfig({
    title: 'Wallpaper',
    id: 'wallpaper',
    window: {
      loadComponent: async () => (await import('./Finder.svelte')).default,
    },
  });
