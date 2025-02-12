<script context="module">
  const baseWidth = 57.6;
  const distanceLimit = baseWidth * 6;
  const beyondTheDistanceLimit = distanceLimit + 1;
  const distanceInput = [
    -distanceLimit,
    -distanceLimit / 1.25,
    -distanceLimit / 2,
    0,
    distanceLimit / 2,
    distanceLimit / 1.25,
    distanceLimit,
  ];
  const widthOutput = [
    baseWidth,
    baseWidth * 1.1,
    baseWidth * 1.414,
    baseWidth * 2,
    baseWidth * 1.414,
    baseWidth * 1.1,
    baseWidth,
  ];
</script>

<script lang="ts">
  import { interpolate } from 'popmotion';
  import { onDestroy } from 'svelte';
  import { sineInOut } from 'svelte/easing';
  import { spring, tweened } from 'svelte/motion';
  import { prefersReducedMotion } from 'os/macos/stores/prefers-motion.store';
  import { theme } from 'os/macos/stores/theme.store';
  import type { DockItemConfig } from '__/stores/dock.store';
  import { openWindows } from '__/stores/window.store';

  export let mouseX: number | null;
  export let dockItem: DockItemConfig;

  // dockItem = title={...dockItem}
  //         isOpen={}
  //         onClick={() => {
  //           dockItem.onClick();
  //         }}

  $: isOpen = Boolean($openWindows.find(([id, w]) => w.appID === dockItem.appID));

  let onClick: (e: MouseEvent) => void = dockItem.onClick;
  let title: string = dockItem.title;
  export let badge: string | undefined = undefined;

  let imageEl: HTMLDivElement;

  let distance = beyondTheDistanceLimit;

  const widthPX = spring(baseWidth, {
    damping: 0.47,
    stiffness: 0.12,
  });

  $: $widthPX = interpolate(distanceInput, widthOutput)(distance);

  let raf: number;
  function animate() {
    if (imageEl && mouseX !== null) {
      const rect = imageEl.getBoundingClientRect();

      // get the x coordinate of the img DOMElement's center
      // the left x coordinate plus the half of the width
      const imgCenterX = rect.left + rect.width / 2;

      // difference between the x coordinate value of the mouse pointer
      // and the img center x coordinate value
      const distanceDelta = mouseX - imgCenterX;
      distance = distanceDelta;
      return;
    }

    distance = beyondTheDistanceLimit;
  }

  $: {
    mouseX;

    if (!$prefersReducedMotion) {
      raf = requestAnimationFrame(animate);
    }
  }

  // Spring animation for the click animation
  const appOpenIconBounceTransform = tweened(0, {
    duration: 400,
    easing: sineInOut,
  });

  async function handleClick(e: MouseEvent) {
    // if (!shouldOpenWindow) return externalAction?.(e);

    // $openApps[appID] = true;
    // $activeApp = appID;

    onClick?.(e);

    // Animate the icon
    await appOpenIconBounceTransform.set(-39.2);

    // Now animate it back to its place
    await appOpenIconBounceTransform.set(0);
  }

  onDestroy(() => {
    cancelAnimationFrame(raf);
  });
</script>

<button on:click={handleClick} aria-label="Launch {title} app" class="dock-open-app-button">
  <p
    class="tooltip"
    class:dark={$theme.scheme === 'dark'}
    style="top: {$prefersReducedMotion ? '-50px' : '-35%'};"
  >
    {title}
  </p>
  <span style="transform: translate3d(0, {$appOpenIconBounceTransform}%, 0); z-index: 0">
    <div style="width: {$widthPX / 16}rem" bind:this={imageEl}>
      <slot name="icon">
        <img
          bind:this={imageEl}
          src="/assets/app-icons/finder/256.webp"
          alt="{title} app"
          draggable="false"
        /></slot
      >
    </div>
  </span>
  <div
    class="dot absolute w-1 h-1 top-full rounded-full z-10 {isOpen ? 'opacity-100' : 'hidden'}"
  />
  {#if badge !== undefined}
    <div
      class="pwa-badge"
      style="font-size: {$widthPX / 57.6}rem; width: {(1.5 * $widthPX) / 57.6}rem; height: {(1.5 *
        $widthPX) /
        57.6}rem; line-height: {(1.5 * $widthPX) / 57.6}rem;"
    >
      {badge}
    </div>
  {/if}
</button>

<style lang="scss">
  img {
    will-change: width;
  }

  button {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    position: relative;

    &:hover,
    &:focus-visible {
      .tooltip {
        display: block;
      }
    }

    & > span {
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }

  .tooltip {
    --double-border: 0 0 0 0 white;

    white-space: nowrap;

    position: absolute;
    z-index: 1000;

    background-color: hsla(var(--system-color-light-hsl), 0.5);
    backdrop-filter: blur(5px);

    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;

    box-shadow: hsla(0deg, 0%, 0%, 30%) 0px 1px 5px 2px, var(--double-border);

    color: var(--system-color-light-contrast);
    font-family: var(--app-font-family);
    font-weight: 400;
    font-size: 0.9rem;
    letter-spacing: 0.4px;

    display: none;

    &.dark {
      --double-border: inset 0 0 0 0.9px hsla(var(--system-color-dark-hsl), 0.3),
        0 0 0 1.2px hsla(var(--system-color-light-hsl), 0.3);
    }
  }

  .dot {
    background-color: var(--system-color-dark);
  }

  .pwa-badge {
    position: absolute;
    top: 1px;
    right: -1px;
    background-color: rgba(248, 58, 58, 0.85);
    box-shadow: hsla(var(--system-color-dark-hsl), 0.4) 0px 0.5px 2px;
    color: white;
    border-radius: 50%;
    pointer-events: none;
    vertical-align: middle;
    margin: 0;
    padding: 0;
    text-align: center;
  }
</style>
