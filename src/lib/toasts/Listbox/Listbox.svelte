<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import { key } from './key';

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
