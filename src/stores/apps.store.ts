import { writable } from 'svelte/store';
import calculator from '__/components/apps/Calculator/calculator';
import calendar from '__/components/apps/Calendar/calendar';
import finder from '__/components/apps/Finder/finder';
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
