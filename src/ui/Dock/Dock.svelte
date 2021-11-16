<script lang="ts">
  import DockItem from './DockItem.svelte';
  import { installedApps } from 'os/stores/apps.store';
  import { createWindow, openWindows } from 'os/stores/window.store';

  let mouseX: number | null = null;
</script>

<section class="dock-container">
  <div
    class="dock-el"
    on:mousemove={(event) => (mouseX = event.x)}
    on:mouseleave={() => (mouseX = null)}
  >
    {#each Object.entries($installedApps) as [appID, appConfig]}
      {#if appConfig.dock}
        <DockItem
          {mouseX}
          title={appConfig.title}
          isOpen={Boolean($openWindows.find(([id, w]) => w.app.id === appConfig.id))}
          onClick={() => {
            if (appConfig.dock.onClick) {
              appConfig.dock.onClick();
            }
            if (appConfig.window) {
              createWindow(appConfig).open();
            }
          }}
        >
          <img
            slot="icon"
            alt="{appConfig.title} app"
            style="width: 100%; height: 100%"
            draggable="false"
            src={appConfig.dock?.icon ?? `/assets/app-icons/${appConfig.id}/256.webp`}
          />
        </DockItem>
      {/if}
    {/each}
    <div class="divider" aria-hidden="true" />
  </div>
</section>

<style lang="scss">
  .dock-container {
    margin-bottom: 0.3rem;
    left: 0;
    bottom: 0;
    z-index: 9900;
    position: fixed;

    width: 100%;
    height: 5.2rem;

    padding: 0.4rem;

    display: flex;
    justify-content: center;
  }

  .dock-el {
    background-color: hsla(var(--system-color-light-hsl), 0.4);

    box-shadow: inset 0 0 0 0.2px hsla(var(--system-color-grey-100-hsl), 0.7),
      0 0 0 0.2px hsla(var(--system-color-grey-900-hsl), 0.7), hsla(0, 0%, 0%, 0.3) 2px 5px 19px 7px;

    position: relative;

    padding: 0.3rem;

    border-radius: 1.2rem;

    height: 100%;

    display: flex;
    align-items: flex-end;

    &::before {
      content: '';

      border-radius: 20px;

      width: 100%;
      height: 100%;

      border: inherit;

      backdrop-filter: blur(10px);

      position: absolute;
      top: 0;
      left: 0;

      z-index: -1;
    }
  }
</style>
