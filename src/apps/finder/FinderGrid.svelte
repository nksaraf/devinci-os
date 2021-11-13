<script lang="ts">
  import { onMount } from 'svelte';
  import FinderItem from './FinderItem.svelte';

  export let cellWidth = 128,
    cellHeight = 140,
    iconSize = 18,
    onDesktop = false,
    path = '/home',
    flow = 'row',
    align = 'right',
    rows = 5,
    cols = 10,
    gridGap = 4,
    overflow = false;

  let items = [];

  async function readFiles() {
    items = kernel.fs.readdirSync(path).map((file) => {
      let stats = kernel.fs.statSync(`${path}/${file}`, false);
      return {
        name: file,
        path: `${path}/${file}`,
        type: stats.isDirectory() ? 'folder' : 'file',
        size: stats.size,
      };
    });
  }

  onMount(() => {
    readFiles();
    // fs.watch(path, () => {
    //   readFiles();
    // });
  });

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
