import { writable } from 'svelte/store';

export const selection = writable<string[]>([]);
