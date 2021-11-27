<script lang="ts">
  import { createEventDispatcher, getContext } from 'svelte';
  import CloseIcon from '@ui/components/SVG/traffic-lights/CloseSVG.svelte';
  import MinimizeSvg from '@ui/components/SVG/traffic-lights/MinimizeSVG.svelte';
  import { activeWindow, IWindow } from '__/stores/window.store';
  import StretchSvg from '@ui/components/SVG/traffic-lights/StretchSVG.svelte';

  const dispatch = createEventDispatcher();

  let window: IWindow = getContext('window');

  function redLightAction() {
    dispatch('red-light');
  }

  function greenLightAction() {
    dispatch('green-light');
  }

  function yellowLightAction() {
    dispatch('yellow-light');
  }
</script>

<div class="container" class:unfocused={$activeWindow !== window.id}>
  <button class="red-light" on:click={redLightAction}>
    <slot name="red-light">
      <CloseIcon />
    </slot>
  </button>
  <button class="yellow-light" on:click={yellowLightAction}>
    <slot name="yellow-light">
      <MinimizeSvg />
    </slot>
  </button>
  <button class="green-light" on:click={greenLightAction}>
    <slot name="green-light">
      <StretchSvg />
    </slot>
  </button>
</div>

<style lang="scss">
  .container {
    --button-size: 0.8rem;

    // pointer-events: none;

    display: grid;
    grid-template-columns: repeat(3, var(--button-size));
    align-items: center;
    gap: 0.6rem;

    height: 100%;

    &.unfocused button {
      --bgcolor: #b6b6b7;
      --border-color: hsla(var(--system-color-dark-hsl), 0.5);
    }

    :global(svg) {
      visibility: hidden;
    }

    &:hover :global(svg) {
      visibility: visible;
    }
  }

  button {
    height: var(--button-size);
    width: var(--button-size);

    // pointer-events: initial;

    border-radius: 50%;

    background-color: var(--bgcolor);
    box-shadow: 0 0 0 0.5px var(--border-color);
  }

  .red-light {
    --bgcolor: #ff5f56;
    --border-color: #e0443e;
  }

  .green-light {
    --bgcolor: #27c93f;
    --border-color: #1aab29;
    transform: rotate(90deg);
  }

  .yellow-light {
    --bgcolor: #ffbd2e;
    --border-color: #dea123;
  }
</style>
