<!-- Based off of https://github.com/timolins/react-hot-toast/blob/HEAD/src/components/error.tsx -->
<script lang="ts">
	let className = '';

	export { className as class };
</script>

<div class={className} />

<style>
	div {
		width: 20px;
		opacity: 0;
		height: 20px;
		border-radius: 10px;
		background: #ff4b4b;
		position: relative;
		transform: rotate(45deg);

		animation: circle 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
		animation-delay: 100ms;
	}
	div:after,
	div:before {
		content: '';
		animation: firstLine 0.15s ease-out forwards;
		animation-delay: 150ms;
		position: absolute;
		border-radius: 3px;
		opacity: 0;
		background: #fff;
		bottom: 9px;
		left: 4px;
		height: 2px;
		width: 12px;
	}

	div:before {
		animation: secondLine 0.15s ease-out forwards;
		animation-delay: 180ms;
		transform: rotate(90deg);
	}

	@keyframes circle {
		from {
			transform: scale(0) rotate(45deg);
			opacity: 0;
		}
		to {
			transform: scale(1) rotate(45deg);
			opacity: 1;
		}
	}

	@keyframes firstLine {
		from {
			transform: scale(0);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes secondLine {
		from {
			transform: scale(0) rotate(90deg);
			opacity: 0;
		}
		to {
			transform: scale(1) rotate(90deg);
			opacity: 1;
		}
	}
</style>
