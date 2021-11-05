<script lang="ts">
  import { key } from './key';
  import { setContext } from 'svelte';
  import { flip } from 'svelte/animate';
  import { quintOut } from 'svelte/easing';
  import BaseToast from './BaseToast.svelte';
  import type { Position } from './position';
  import { freezeToasts, thawToasts } from './toast';
  import { toastEntries } from './toasts.store';

  export let reversed = false;
  export let position: Position = 'top-center';

  setContext(key, {
    getPosition: () => position,
  });

  function getToastList(position: Position, toasts: typeof $toastEntries) {
    const isPositionTop = position.slice(0, 3) === 'top';

    if (isPositionTop) {
      return reversed ? toasts : [...toasts].reverse();
    } else {
      return reversed ? [...toasts].reverse() : toasts;
    }
  }

  function getAlignment(position: Position) {
    const horizontalPosition = position.split('-')[1];
    switch (horizontalPosition) {
      case 'left':
        return 'items-start';
      case 'right':
        return 'items-end';
      default:
        return 'items-center';
    }
  }

  $: toastList = getToastList(position, $toastEntries);
</script>

<div class="z-[9999] font-sans fixed inset-0 mt-8 mr-4 pointer-events-none">
  <div
    class="absolute flex flex-col {{
      'top-left': 'top-0 left-0',
      'top-center': 'top-0 left-0 right-0',
      'top-right': 'top-0 right-0',
      'bottom-left': 'bottom-0 left-0',
      'bottom-center': 'bottom-0 left-0 right-0',
      'bottom-right': 'bottom-0 right-0',
    }[position]}"
  >
    <div class="flex-grow-0 flex flex-col {getAlignment(position)}">
      {#each toastList as [key, { text, component, style }] (key)}
        <div
          animate:flip={{ duration: 325, easing: quintOut }}
          class="flex-none my-1 pointer-events-auto"
          on:mouseenter={freezeToasts}
          on:mouseleave={thawToasts}
        >
          <BaseToast {text} {component} {style} />
        </div>
      {/each}
    </div>
  </div>
</div>
