import { createAppConfig } from 'os/macos/stores/apps.store';

export default () =>
  createAppConfig({
    title: 'Wallpaper',
    id: 'wallpapers',
    window: {
      loadComponent: async () =>
        (await import('@ui/components/apps/WallpaperApp/WallpaperSelectorApp.svelte')).default,
    },
  });
