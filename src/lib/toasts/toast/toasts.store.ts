import { derived, writable } from 'svelte/store';
import type { Toast } from './toast';

export const toasts = writable({});
export const toastEntries = derived(toasts, ($toasts) => Object.entries<Toast>($toasts));
