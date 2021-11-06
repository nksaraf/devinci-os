<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { draggable } from 'svelte-drag';
  import { sineInOut } from 'svelte/easing';
  import { randint } from '__/helpers/random';
  import { waitFor } from '__/helpers/wait-for';
  import { lastFocusedIndex, WindowAPI } from '__/stores/window.store';
  import { prefersReducedMotion } from '__/stores/prefers-motion.store';
  import { theme } from '__/stores/theme.store';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import StretchSvg from '@ui/components/SVG/traffic-lights/StretchSVG.svelte';
  import TrafficLights from './TrafficLights.svelte';
  import Placeholder from '@ui/components/apps/Placeholder/Placeholder.svelte';

  export let window: WindowAPI;
  export let id: number;

  let isBeingDragged = false;
  let draggingEnabled = true;

  let isMaximized = false;
  let minimizedTransform: string;

  let windowEl: HTMLElement;

  let windowData = $window;

  let {
    height,
    width,
    app,
    fullScreenable,
    title,
    frame,
    maximizable,
    minimizable,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    resizable,
    transparent,
    fullScreen,
    loadComponent,
    zIndex,
  } = windowData;

  setContext('window', windowData);

  const randX = randint(-600, 600);
  const randY = randint(-100, 100);

  let defaultPosition = {
    x: (document.body.clientWidth / 2 + randX) / 2,
    y: (100 + randY) / 2,
  };

  function focusApp() {
    zIndex = $lastFocusedIndex + 1;
    lastFocusedIndex.set(zIndex);
    window.focus();

    if (!fullScreen) {
      windowEl?.focus();
    }
  }

  // function windowOpenTransition(
  //   el: HTMLElement,
  //   { duration = prefersReducedMotion ? 0 : 300 }: SvelteTransitionConfig,
  // ): SvelteTransitionReturnType {
  //   const { left, right, height, width } = document
  //     .querySelector(`button.dock-open-app-button.${appID}`)
  //     .getBoundingClientRect();

  //   el.style.transform = `translate()`;

  //   return {
  //     duration,
  //     easing: sineInOut,
  //     css: (t) => `opacity: ${t}; transform:  scale(${t})`,
  //   };
  // }

  function windowCloseTransition(
    el: HTMLElement,
    { duration = $prefersReducedMotion ? 0 : 300 }: SvelteTransitionConfig,
  ): SvelteTransitionReturnType {
    const existingTransform = getComputedStyle(el).transform;

    return {
      duration,
      easing: sineInOut,
      css: (t) => `opacity: ${t}; transform: ${existingTransform} scale(${t})`,
    };
  }

  async function maximizeApp() {
    if (!$prefersReducedMotion) {
      windowEl.style.transition = 'height 0.3s ease, width 0.3s ease, transform 0.3s ease';
    }

    if (!isMaximized) {
      draggingEnabled = false;

      minimizedTransform = windowEl.style.transform;
      windowEl.style.transform = `translate(0px, 0px)`;

      windowEl.style.width = `100%`;
      windowEl.style.height = '100%';
    } else {
      draggingEnabled = true;
      windowEl.style.transform = minimizedTransform;

      windowEl.style.width = `${+width / 16}rem`;
      windowEl.style.height = `${+height / 16}rem`;
    }

    isMaximized = !isMaximized;

    await waitFor(300);

    if (!$prefersReducedMotion) windowEl.style.transition = '';
  }

  onMount(() => {
    focusApp();
  });
</script>

{#if fullScreen}
  <section
    class="window"
    data-window-id={id}
    data-app-id={app.id}
    class:dark={$theme.scheme === 'dark'}
    class:background={!transparent}
    class:transparent
    class:window-shadow={frame}
    w-full
    top-0
    left-0
    h-full
    tabindex="-1"
    bind:this={windowEl}
    out:windowCloseTransition
  >
    {#if frame}
      <div
        bg-gray-200
        w-full
        p-2
        h-8
        class="full-screen-app-header grid {app.id}"
        on:click={focusApp}
      >
        <TrafficLights
          on:green-light={maximizeApp}
          on:red-light={(e) => {
            window.close();
          }}
        >
          {#if fullScreenable}
            <ExpandSvg slot="green-light" />
          {:else}
            <StretchSvg slot="green-light" />
          {/if}
        </TrafficLights>
        <div>{title}</div>
      </div>
    {/if}
    <div style="height: 100%; width: 100%; overflow: scroll;">
      {#if loadComponent}
        {#await loadComponent() then Component}
          <div><svelte:component this={Component} /></div>
        {/await}
      {:else}
        <Placeholder appID={app.id} />
      {/if}
    </div>
  </section>
{:else}
  <section
    w-full
    h-full
    class:bg-gray-100={!transparent}
    class:transparent
    class:window-shadow={frame}
    class="window"
    class:dark={$theme.scheme === 'dark'}
    style="width: {+width / 16}rem;height: {+height / 16}rem; z-index: {zIndex}"
    tabindex="-1"
    bind:this={windowEl}
    use:draggable={{
      defaultPosition,
      handle: '.app-window-drag-handle',
      bounds: { bottom: 84, top: 22.7, left: -600, right: -600 },
      disabled: !draggingEnabled,
      gpuAcceleration: false,
    }}
    on:svelte-drag:start={() => {
      focusApp();
      isBeingDragged = true;
    }}
    on:svelte-drag:end={() => (isBeingDragged = false)}
    on:click={focusApp}
    out:windowCloseTransition
  >
    <div class="tl-container {app.id}">
      <TrafficLights
        on:green-light={maximizeApp}
        on:red-light={(e) => {
          window.close();
        }}
      >
        {#if fullScreenable}
          <ExpandSvg slot="green-light" />
        {:else}
          <StretchSvg slot="green-light" />
        {/if}
      </TrafficLights>
    </div>

    <div style="height: 100%; width: 100%; overflow: scroll; border-radius: inherit;">
      {#if loadComponent}
        {#await loadComponent() then Component}
          <svelte:component this={Component} />
        {/await}
      {:else}
        <Placeholder appID={app.id} />
      {/if}
    </div>
  </section>
{/if}

<style lang="scss">
  .full-screen-app-header {
    grid-template-columns: 1fr auto 1fr;
  }

  .window {
    cursor: var(--app-cursor-default), auto;
    position: absolute;
  }

  .background {
    background-color: var(--system-color-light);
  }

  .window-shadow {
    border-radius: 0.75rem;
    box-shadow: 0px 9.9px 14.8px rgba(0, 0, 0, 0.205), 0px 79px 118px rgba(0, 0, 0, 0.41);

    &.dark {
      & > :global(section),
      & > :global(div) {
        border-radius: inherit;
        box-shadow: inset 0 0 0 0.9px hsla(var(--system-color-dark-hsl), 0.3),
          0 0 0 1px hsla(var(--system-color-light-hsl), 0.5);
      }
    }
  }

  .tl-container {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 1;

    // Necessary, as `.container` tries to apply shadow on it
    box-shadow: none !important;
  }
</style>
