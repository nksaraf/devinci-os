<script lang="ts">
  import FinderGrid from './FinderGrid.svelte';
</script>

<div class="flex flex-row relative" h-full w-full>
  <nav h-full w-36 class="finder-left-panel" />
  <div class="flex flex-col flex-1" style="overflow: hidden" h-full>
    <header
      class="app-window-drag-handle finder-header h-14 bg-white flex flex-row items-center px-8"
    >
      <div class="i-bi-chevron-left text-lg" />
      <div class="i-bi-chevron-right ml-8 text-lg" />
      <div class="ml-4 text-gray-600 text-lg font-bold">
        {'home'}
      </div>
    </header>
    <section style="flex: 1; overflow:scroll;max-width: 100%;" bg-white>
      <FinderGrid
        path="/"
        flow="row"
        align="left"
        cols={6}
        rows={10}
        iconSize={56}
        cellWidth={108}
        cellHeight={110}
      />
    </section>
  </div>
</div>

<style lang="scss">
  .finder-left-panel {
    background: #d6dee4ee;
    backdrop-filter: blur(10px);
  }
</style>
