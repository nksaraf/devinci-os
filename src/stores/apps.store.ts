import { derived, writable } from 'svelte/store';
import calculator from 'os/apps/calculator/calculator';
import calendar from 'os/apps/calendar/calendar';
import finder from 'os/finder/finder
import { openWindows } from './window.store';
import type { WindowConfig } from './window.store';

export type AppID = string;

export type AppConfig = {
  id: string;
  title: string;
  window?: WindowConfig;
  dock?: {
    icon?: string;
  };
};

export const createAppConfig = (
  et: Partial<Omit<AppConfig, 'window'>> & { window: Partial<WindowConfig> },
): AppConfig => et as AppConfig;

export const installedApps = writable<Record<AppID, AppConfig>>({});

export function installApp(config: AppConfig) {
  installedApps.update((apps) => {
    const newApps = { ...apps, [config.id]: config };
    return newApps;
  });
}

installApp(finder());
installApp(calculator());
installApp(calendar());

/** Which app is currently focused */
export const activeApp = writable<AppID>('');

// only for macos-web
export const activeAppZIndex = writable(-2);

export const openApps = derived([openWindows, installedApps], ([windows, apps]) => {
  return windows.reduce((acc, [id, window]) => {
    const app = apps[window.app.id];
    if (app) {
      acc[app.id] = true;
    }
    return acc;
  }, {} as Record<AppID, boolean>);
});
