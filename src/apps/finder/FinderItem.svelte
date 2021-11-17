<script lang="ts">
  import type Stats from 'os/kernel/fs/core/stats';

  import { getContext } from 'svelte';

  import { selection } from '__/stores/fs.store';
  import { createWindow } from '__/stores/window.store';
  import editor from '../editor/editor';
  import finder from './finder';

  export let item: {
    name: string;
    path: string;
    stats: Stats;
  };

  export let onDesktop: boolean = false;

  $: selected = $selection.includes(item.path);

  function addToSelection(e: MouseEvent) {
    console.log('selecting', e);
    selection.update((sel) => {
      let path = item.path;
      if (e.metaKey) {
        sel = sel.includes(path) ? sel : sel.concat(path);
      } else if (e.shiftKey) {
        sel = sel.includes(path) ? sel.filter((p) => p !== path) : sel.concat(path);
      } else {
        sel = [path];
      }

      return [...sel];
    });
  }

  let finderPath = getContext('finder-path') as { setPath(p: string): void };

  function handleOpen() {
    console.log(finderPath, item.path);

    if (item.stats.isFile()) {
      createWindow(editor(), {
        args: {
          path: item.path,
        },
      }).open();
    } else {
      if (onDesktop) {
        createWindow(finder(), {
          args: {
            path: item.path,
          },
        }).open();
      } else {
        finderPath.setPath(item.path);
      }
    }
  }
</script>

<div
  class="finder-item {selected ? 'selected' : ''}"
  on:dblclick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected) {
      addToSelection(e);
    }

    handleOpen();
  }}
  on:click={(e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected) {
      addToSelection(e);
    }
  }}
>
  <div class="finder-icon-container {selected ? 'selected' : ''} {onDesktop ? 'desktop' : ''}">
    <div class="finder-item-icon">
      {#if item.stats.isDirectory()}
        <img
          src="/assets/app-icons/finder/folder256.png"
          alt={item.path}
          bg-transparent
          w-full
          h-full
        />
      {:else}
        <img
          src="/assets/app-icons/finder/file512.png"
          alt={item.path}
          bg-transparent
          w-full
          h-full
        />
      {/if}
      <!-- <img src={item.icon} /> -->
    </div>
  </div>
  <div
    class="finder-item-name {selected
      ? 'selected text-white'
      : onDesktop
      ? 'text-shadow text-white'
      : 'text-gray-700'} {onDesktop ? 'font-bold text-sm' : 'text-sm'}"
  >
    <span>{item.name}</span>
  </div>
</div>

<style style="scss">
  .finder-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-bottom: 1rem;
    height: var(--finder-cell-height);
    width: var(--finder-cell-width);
    letter-spacing: 0.01rem;
  }

  .finder-item-name {
    padding: 0.025rem 0.5rem;
    max-width: 100%;
    text-align: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .finder-item-name.selected {
    background-color: var(--system-color-primary);
    border-radius: 0.25rem;
  }

  .finder-item-icon {
    height: var(--finder-icon-size);
    width: var(--finder-icon-size);
  }

  .finder-icon-container {
    padding: 0.25rem;
    border: 0.15rem solid transparent;
    margin-bottom: 0.25rem;
  }

  .finder-icon-container.selected.desktop {
    border: 0.15rem solid var(--system-color-grey-400);
    border-radius: 8px;
    background-color: #00000055;
  }

  .finder-icon-container.selected:not(.desktop) {
    background-color: var(--system-color-grey-200);
    border-radius: 8px;
  }

  .text-shadow {
    text-shadow: 1px 2px #00000022;
  }
</style>
