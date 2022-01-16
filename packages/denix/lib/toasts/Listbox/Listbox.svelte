<script lang="ts">
	import { setContext } from 'svelte.ts';
	import { writable } from 'svelte/store.ts';
	import { key } from './key.ts';

	export let selected;

	const selectedStore = writable(selected);
	$: selected = $selectedStore;

	setContext(key, {
		getSelectedStore: () => selectedStore
	});
	let className = '';

	export { className as class };
</script>

<div role="listbox" tabindex="0" class={className}>
	<slot {selected} />
</div>
