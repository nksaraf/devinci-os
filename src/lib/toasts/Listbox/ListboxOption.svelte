<script lang="ts">
	import { getContext } from 'svelte';
	import { key } from './key';

	export let value;

	const { getSelectedStore } = getContext(key);
	const selectedStore = getSelectedStore();
	let className = '';

	export { className as class };
</script>

<button class={className} on:click={() => ($selectedStore = value)} role="option">
	<slot />
</button>
