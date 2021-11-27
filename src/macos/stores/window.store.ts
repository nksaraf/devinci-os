// export

import type { SvelteComponentDev } from 'svelte/internal';
import type { Writable } from 'svelte/store';
import { derived, writable } from 'svelte/store';
import type { AppConfig } from './apps.store';
import { activeApp, installedApps } from './apps.store';

export interface WindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  alwaysOnTop: boolean;
  resizable: boolean;
  title: string;
  frame: boolean;
  args?: Object;
  transparent: boolean;
  fullScreenable: boolean;
  minimizable: boolean;
  maximizable: boolean;
  fullScreen: boolean;
  trafficLights: boolean;
  loadComponent?: () => Promise<SvelteComponentDev | typeof SvelteComponentDev>;
}

export const createWindowConfig = (win: Partial<WindowConfig>): WindowConfig => ({
  width: 600,
  height: 500,
  minWidth: 300,
  minHeight: 300,
  maxWidth: 100000,
  maxHeight: 100000,
  alwaysOnTop: false,
  resizable: true,
  transparent: false,
  fullScreenable: false,
  minimizable: true,
  maximizable: false,
  fullScreen: false,
  trafficLights: true,
  frame: true,
  title: '',
  ...win,
});

export interface IWindow extends WindowConfig {
  id: number;
  app: AppConfig;
  zIndex: number;
}

export interface WindowAPI extends Writable<IWindow> {
  close: () => void;
  open: () => void;
  focus: () => void;
  maximize?: () => void;
  app: AppConfig;
  // minimize: () => void;
  // maximize: () => void;
  // restore: () => void;
  // move: (x: number, y: number) => void;
  // resize: (width: number, height: number) => void;
  // focus: () => void;
  // isFocused: () => boolean;
  // isMaximized: () => boolean;
}

export const openWindows = writable<Array<[number, WindowAPI]>>([]);
export const activeWindow = writable<number>(-1);

export let WINDOW_ID = 0;

export let lastFocusedIndex = writable(0);

export function createWindow(
  appConfig: AppConfig,
  windowConfig?: Partial<WindowConfig>,
): WindowAPI {
  let windowID = WINDOW_ID++;
  let winConfig = createWindowConfig({
    title: appConfig.title,
    ...(typeof appConfig.window === 'function' ? (appConfig.window as any)() : appConfig.window),
    ...(windowConfig ?? {}),
  });
  console.log('createWindow', windowConfig, windowID, winConfig);

  let winData = writable({
    ...winConfig,
    id: windowID,
    app: appConfig,
    zIndex: 0,
  }) as WindowAPI;

  return Object.assign(winData, {
    open: function () {
      console.log('opening window', windowID);
      openWindows.update((windows) => [...windows, [windowID, winData]]);
      activeWindow.set(windowID);
    },
    app: appConfig,
    focus: function () {
      console.log('focusing window', windowID);
      activeWindow.set(windowID);
      activeApp.set(appConfig.id);
    },
    close: function () {
      console.log('closing window', windowID);
      openWindows.update((windows) => {
        console.log(
          windowID,
          windows,
          windows.filter(([id]) => id !== windowID),
        );
        return windows.filter(([id]) => id !== windowID);
      });
    },
  });
}

export const windowsByApp = (app: string) =>
  derived([installedApps, openWindows], ([apps, windows]) =>
    windows.filter(([id, win]) => win.app.id === app),
  );
