import { writable } from 'svelte/store';

export interface DockItemConfig {
  icon?: string;
  title: string;
  onClick: () => void;
  appID?: string;
}

export const dockItems = writable<DockItemConfig[]>([]);

export const addDockItem = (config: DockItemConfig) => {
  dockItems.update((items) => [...items, config]);
};
