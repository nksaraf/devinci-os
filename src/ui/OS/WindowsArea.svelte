<script lang="ts">
  import { openWindows } from 'os/stores/window.store';
</script>

<section id="windows-area">
  {#each $openWindows as [windowID, window] (windowID)}
    {#await import('os/ui/Window/Window.svelte') then { default: Window }}
      <Window id={windowID} {window} />
    {/await}
  {/each}
</section>

<style lang="scss">
  section {
    display: block;

    position: fixed;

    // 1.4 rem is the heigh of the header
    // 5.25 rem is the height of dock
    top: 1.4rem;
    height: calc(100vh - 5.25rem - 1.4rem);

    width: 100vw;

    justify-self: center;
  }
</style>
