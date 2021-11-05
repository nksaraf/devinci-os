<script lang="ts">
	import ErrorIcon from '../Icons/ErrorIcon.svelte';

	export let text: string;
</script>

<ErrorIcon class="flex-shrink-0 mr-2" />
{text}
