<script lang="ts">
  import * as path from 'path';

  import { onMount } from 'svelte';
  import FinderItem from './FinderItem.svelte';
  import { Deno } from 'os/deno';

  export let cellWidth = 128,
    cellHeight = 140,
    iconSize = 18,
    onDesktop = false,
    directory = '/home',
    flow = 'row',
    align = 'right',
    rows = 5,
    cols = 10,
    gridGap = 4,
    overflow = false;

  let items = [];

  async function readFiles(directory) {
    let newItems = [];
    for await (var entry of Deno.readDir(directory)) {
      console.log(entry);
      if (entry.isFile) {
        newItems.push({
          name: entry.name,
          path: path.join(directory, entry.name),
          stats: await Deno.stat(path.join(directory, entry.name)),
        });
      } else {
        newItems.push({
          name: entry.name,
          path: path.join(directory, entry.name),
          stats: await Deno.stat(path.join(directory, entry.name)),
        });
        // let stats = await Deno.stat(`${directory}/${file}`, false);
        // return {
        //   name: file,
        //   path: path.join(directory, file),
        //   stats: stats,
        // };
      }
    }

    items = newItems;
  }

  // onMount(() => {
  //   readFiles();
  //   // fs.watch(path, () => {
  //   //   readFiles();
  //   // });
  // });

  $: readFiles(directory);

  // onDestroy(() => {
  //   fs.events.off('writeFile', readFiles);
  // });
</script>

<div class="grid-container">
  <div
    class="finder-grid {onDesktop ? 'desktop' : ''}"
    style="--finder-icon-size: {iconSize / 16}rem; --finder-cell-width: {cellWidth /
      16}rem; --finder-cell-height: {cellHeight / 16}rem; --finder-grid-gap: {gridGap / 16}rem;"
  >
    {#each items as item, index}
      <div
        class="finder-item-container"
        style="--grid-column-start: {flow === 'column'
          ? align === 'right'
            ? -Math.floor(index / rows) - 1
            : Math.floor(index / rows) + 1
          : // flow === 'row'
          align === 'right'
          ? -(index % cols) - 1
          : (index % cols) + 1}; --grid-row-start: {flow === 'column'
          ? align === 'right'
            ? (index % rows) + 1
            : (index % rows) + 1
          : // flow === 'row'
          align === 'right'
          ? Math.floor(index / cols) + 1
          : Math.floor(index / cols) + 1}"
      >
        <FinderItem {onDesktop} {item} />
      </div>
    {/each}
  </div>
</div>

<style>
  .finder-item-container {
    height: var(--finder-cell-height);
    width: var(--finder-cell-width);
    grid-column-start: var(--grid-column-start);
    grid-row-start: var(--grid-row-start);
  }
  .grid-container {
    width: fit-content;
    height: 100%;
    grid-gap: var(--finder-grid-gap);
  }

  .finder-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, var(--finder-cell-width));
    grid-template-rows: repeat(auto-fit, var(--finder-cell-height));
    grid-auto-flow: rows;
  }
</style>
