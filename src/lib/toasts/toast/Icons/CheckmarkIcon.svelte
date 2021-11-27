<!-- Based off of https://github.com/timolins/react-hot-toast/blob/HEAD/src/components/checkmark.tsx -->
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
		background-color: #61d345;
		position: relative;
		transform: rotate(45deg);

		animation: circle 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
		animation-delay: 100ms;
	}
	div:after {
		content: '';
		box-sizing: border-box;
		animation: checkmark 0.2s ease-out forwards;
		opacity: 0;
		animation-delay: 200ms;
		position: absolute;
		border-right: 2px solid;
		border-bottom: 2px solid;
		border-color: #fff;
		bottom: 6px;
		left: 6px;
		height: 10px;
		width: 6px;
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

	@keyframes checkmark {
		0% {
			height: 0;
			width: 0;
			opacity: 0;
		}
		40% {
			height: 0;
			width: 6px;
			opacity: 1;
		}
		100% {
			opacity: 1;
			height: 10px;
		}
	}
</style>
