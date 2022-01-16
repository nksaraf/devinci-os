<script lang="ts">
	import Spinner from '../Icons/Spinner.svelte.ts';

	export let text: string;
</script>

<div class="w-5 h-5 grid place-items-center mr-2">
	<Spinner class="w-3 h-3 text-black flex-shrink-0" />
</div>
{text}
