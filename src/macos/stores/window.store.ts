import type { SvelteComponentDev } from 'svelte/internal';
import type { Writable } from 'svelte/store';
import { derived, writable } from 'svelte/store';
import { activeApp, installedApps } from './apps.store';

export interface WebViewConfig {
  appID: any;
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
  overflow: boolean;
  maximizable: boolean;
  fullScreen: boolean;
  trafficLights: boolean;
  url?: string;
  loadComponent?: () => Promise<SvelteComponentDev | typeof SvelteComponentDev>;
}

export const createWebViewConfig = (win: Partial<WebViewConfig>): WebViewConfig => ({
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
  appID: undefined,
  overflow: false,
  ...win,
});

export interface WebViewInstance extends WebViewConfig {
  id: number;
  appID: string;
  zIndex: number;
}

export interface WebViewAPI extends Writable<WebViewInstance> {
  appID: string;
  close: () => void;
  open: () => void;
  focus: () => void;
  maximize?: () => void;
  dragHandleClass?: string;
  // minimize: () => void;
  // maximize: () => void;
  // restore: () => void;
  // move: (x: number, y: number) => void;
  // resize: (width: number, height: number) => void;
  // focus: () => void;
  // isFocused: () => boolean;
  // isMaximized: () => boolean;
}

export const openWindows = writable<Array<[number, WebViewAPI]>>([]);
export const activeWindow = writable<number>(-1);

export let WEBVIEW_ID = 0;

export let lastFocusedIndex = writable(0);

export class WebView extends EventTarget {
  id: number;
  store: WebViewAPI;
  config: WebViewConfig;
  constructor(config: Partial<WebViewConfig>) {
    super();
    let windowID = WEBVIEW_ID++;
    let winConfig = createWebViewConfig({
      // title: appConfig.title,
      // ...(typeof appConfig.window === 'function' ? (appConfig.window as any)() : appConfig.window),
      ...(config ?? {}),
    });
    this.config = winConfig;
    this.id = windowID;
    this.store = Object.assign(
      writable({
        ...winConfig,
        id: windowID,
        zIndex: 0,
      }),
      {
        appID: winConfig.appID,
        focus: this.focus.bind(this),
        close: this.close.bind(this),
      },
    ) as WebViewAPI;
  }

  open() {
    console.log('opening window', this.id);
    openWindows.update((windows) => [...windows, [this.id, this.store]]);
    activeWindow.set(this.id);
  }

  close() {
    console.log('closing window', this.id);
    openWindows.update((windows) => {
      console.log(
        this.id,
        windows,
        windows.filter(([id]) => id !== this.id),
      );
      return windows.filter(([id]) => id !== this.id);
    });
  }

  focus() {
    console.log('focusing window', this.id);
    activeWindow.set(this.id);
    if (this.store.appID) {
      activeApp.set(this.store.appID);
    }
  }
}

export const windowsByApp = (app: string) =>
  derived([installedApps, openWindows], ([apps, windows]) =>
    windows.filter(([id, win]) => win.appID === app),
  );
