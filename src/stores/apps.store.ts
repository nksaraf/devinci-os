import { derived, writable } from 'svelte/store';
import calculator from 'os/apps/calculator/calculator';
import calendar from 'os/apps/calendar/calendar';
import finder from 'os/apps/finder/finder';
import { openWindows } from './window.store';
import type { WindowConfig } from './window.store';
import editor from 'os/apps/editor/editor';
import terminal from 'os/apps/terminal/terminal';
import vscode from 'os/apps/vscode/vscode';

export type AppID = string;

export type AppConfig = {
  id: string;
  title: string;
  window: WindowConfig | (() => WindowConfig);
  dock?: {
    icon?: string;
  };
};

export const createAppConfig = (
  et: Partial<Omit<AppConfig, 'window'>> & {
    window: Partial<WindowConfig> | (() => Partial<WindowConfig>);
  },
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
installApp(editor());
installApp(terminal());
installApp(vscode());

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
