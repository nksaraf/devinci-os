<script lang="ts">
  import fs from 'os/lib/fs';
  import { onDestroy, onMount } from 'svelte';

  export let cellWidth = 128,
    cellHeight = 140,
    iconSize = 18,
    onDesktop = false,
    path = '/home';

  let items = [];

  async function readFiles() {
    items = await fs.promises.readdir(path);
  }

  onMount(() => {
    readFiles();
    fs.events.on('writeFile', readFiles);
  });

  onDestroy(() => {
    fs.events.off('writeFile', readFiles);
  });
</script>

<div class="grid-container">
  <div class="finder-grid {onDesktop ? 'desktop' : ''}" />
  {#each items as item}
    <div class="grid-item">
      <div class="grid-item-icon">
        <!-- <img src={item.icon} /> -->
      </div>
      <div class="grid-item-name">{item}</div>
    </div>
  {/each}
</div>
