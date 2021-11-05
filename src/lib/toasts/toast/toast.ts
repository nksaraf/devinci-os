import type { SvelteComponent } from 'svelte';
import { get } from 'svelte/store';
import { toastEntries } from './toasts.store';
import { toasts } from './toasts.store';
import DefaultToast from './toasts/DefaultToast.svelte';
import ErrorToast from './toasts/ErrorToast.svelte';
import SuccessToast from './toasts/SuccessToast.svelte';
import LoadingToast from './toasts/LoadingToast.svelte';

let uid = 0;

let timeouts = [];

export function freezeToasts() {
	console.log('🥶');
	for (const timeout of timeouts) {
		clearTimeout(timeout);
	}
}
export function thawToasts() {
	let toasts = get(toastEntries);
	let firstCreatedAt = toasts[0][1].createdAt;

	for (const [key, toast] of toasts) {
		const offset = toast.createdAt.getTime() - firstCreatedAt.getTime();
		const ms = toast.duration / 3 + offset;

		const timeout = setTimeout(() => {
			clearToast(+key);
		}, ms);
		timeouts.push(timeout);
	}
}

export interface Toast {
	text: string;
	duration: number;
	component: typeof SvelteComponent;
	createdAt?: Date;
	style?: string;
}

function dispatchToast({ text, duration, component, createdAt = new Date(), style }: Toast) {
	const id = uid++;
	const newToast = { text, duration, component, createdAt, style };
	toasts.update((toasts) => ({ ...toasts, [id]: newToast }));

	if (typeof duration === 'number') {
		const timeout = setTimeout(() => {
			clearToast(id);
		}, duration);
		timeouts.push(timeout);
	}
	return id;
}

function mutateToast(id: number, newToastFn: (oldToast: Toast) => Toast) {
	const oldToast: Toast = get(toasts)?.[id];
	if (!oldToast) {
		throw new Error(`Toast with id of ${id} does not exist.`);
	}

	const newToast = newToastFn(oldToast);
	if (typeof newToast.duration === 'number') {
		const timeout = setTimeout(() => {
			clearToast(id);
		}, newToast.duration);
		timeouts.push(timeout);
	}
	toasts.update((toasts) => {
		toasts[id] = newToast;
		return toasts;
	});
}

function clearToast(id: number) {
	toasts.update((toasts) => {
		if (toasts[id]) {
			delete toasts[id];
		}
		// Reset uid if there aren't any toasts left.
		if (Object.keys(toasts).length === 0) {
			uid = 0;
		}
		return toasts;
	});
}

function clearAll() {
	toasts.set({});
}

interface ToastOptions {
	duration?: number;
	style?: string;
}

function toast(
	text: string,
	{ duration = 5000, style = '' }: ToastOptions = { duration: 5000, style: '' }
) {
	dispatchToast({ text, duration, component: DefaultToast, style });
}

toast.success = (
	text: string,
	{ duration = 5000, style = '' }: ToastOptions = { duration: 5000, style: '' }
) => {
	dispatchToast({ text, duration, component: SuccessToast, style });
};

toast.error = (
	text: string,
	{ duration = 5000, style = '' }: ToastOptions = { duration: 5000, style: '' }
) => {
	dispatchToast({ text, duration, component: ErrorToast, style });
};

toast.loading = (
	text: string,
	{ duration = 5000, style = '' }: ToastOptions = { duration: 5000, style: '' }
) => {
	dispatchToast({ text, duration, component: LoadingToast, style });
};

// interface ToastPromiseOptions {}
toast.promise = (
	promise: Promise<any>,
	{ loading, success, error, duration = 5000, style = '' }
) => {
	const toastId = dispatchToast({ text: loading, duration: null, component: LoadingToast, style });

	promise
		.then(() => {
			mutateToast(toastId, (oldToast) => ({
				...oldToast,
				text: success,
				duration,
				component: SuccessToast,
				style
			}));
		})
		.catch(() => {
			mutateToast(toastId, (oldToast) => ({
				...oldToast,
				text: error,
				duration,
				component: ErrorToast,
				style
			}));
		});

	return promise;
};

toast.clearAll = clearAll;

export { toast };
