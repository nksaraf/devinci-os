<script lang="ts">
  import { openWindows } from 'os/macos/stores/window.store';
  let iframe: HTMLIFrameElement;

  $: {
    if (iframe) {
      // (async () => {
      //   iframe.srcdoc = await (await fetch('http://localhost:4507')).text();
      // })();
    }
  }
</script>

<section id="windows-area">
  {#each $openWindows as [windowID, window] (windowID)}
    {#await import('os/macos/ui/Window/Window.svelte') then { default: Window }}
      <Window id={windowID} {window} />
    {/await}
  {/each}
  <!-- <iframe bind:this={iframe} class="h-screen w-screen" src="http://localhost/~p/4507/" /> -->
  <!-- <iframe src="http://localhost:3000/p/4057/" class="h-screen w-screen" /> -->
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
