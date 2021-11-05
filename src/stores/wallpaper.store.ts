import { writable } from 'svelte-local-storage-store';

export type WallpaperID = string;

type WallpaperSettings = {
  id: WallpaperID;
  image: string;
  canControlTheme: boolean;
};

export const wallpaper = writable<WallpaperSettings>('macos:wallpaper-settings', {
  image: '37-2',
  id: 'monterey',
  canControlTheme: true,
});
