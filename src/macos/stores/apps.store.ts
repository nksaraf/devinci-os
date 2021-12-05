import { derived, writable } from 'svelte/store';
import { openWindows } from './window.store';
import type { WebViewConfig } from './window.store';

export type AppID = string;

export type AppConfig = {
  id: string;
  title: string;
  window?: WebViewConfig | (() => WebViewConfig);
  dock?: {
    icon?: string;
    onClick?: () => void;
  };
};

export const createAppConfig = (
  et: Partial<Omit<AppConfig, 'window'>> & {
    window?: Partial<WebViewConfig> | (() => Partial<WebViewConfig>);
  },
): AppConfig => et as AppConfig;

export const installedApps = writable<Record<AppID, AppConfig>>({});

export function installApp(config: AppConfig) {
  installedApps.update((apps) => {
    const newApps = { ...apps, [config.id]: config };
    return newApps;
  });
}

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
