<script lang="ts">
  export let path: string = '';
  export let onDesktop: boolean = false;
</script>

<div class="finder-item">
  <div class="finder-item-icon">
    <img src="/assets/app-icons/finder/folder256.png" alt={path} w-full h-full />
    <!-- <img src={item.icon} /> -->
  </div>
  <div
    class="finder-item-name {onDesktop ? 'text-shadow text-white font-bold text-sm' : 'text-sm'}"
  >
    {path}
  </div>
</div>

<style>
  .finder-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: var(--finder-cell-height);
    width: var(--finder-cell-width);
    letter-spacing: 0.01rem;
  }

  .finder-item-icon {
    height: var(--finder-icon-size);
    width: var(--finder-icon-size);
    margin-bottom: 0.75rem;
  }

  .text-shadow {
    text-shadow: 1px 2px #00000022;
  }
</style>
