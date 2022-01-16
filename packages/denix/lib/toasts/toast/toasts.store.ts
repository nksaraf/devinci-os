import { derived, writable } from 'svelte/store.ts';
import type { Toast } from './toast.ts';

export const toasts = writable({});
export const toastEntries = derived(toasts, ($toasts) => Object.entries<Toast>($toasts));
