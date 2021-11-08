<script lang="ts">
  import TopBar from '@ui/components/TopBar/TopBar.svelte';
  import Wallpaper from '@ui/components/apps/WallpaperApp/Wallpaper.svelte';
  import Dock from '../Dock/Dock.svelte';
  import { onMount } from 'svelte';
  import { createWindow } from 'os/stores/window.store';
  import WindowsArea from './WindowsArea.svelte';
  import finder from 'os/apps/finder/finder';
  import BootupScreen from '@ui/components/Desktop/BootupScreen.svelte';
  import GitCloner from './GitCloner.svelte';
  import Toaster from 'os/lib/toasts';

  export let url = '';

  onMount(() => {
    createWindow(finder(), {
      fullScreen: true,
      frame: false,
      transparent: true,
      loadComponent: async () => (await import('os/apps/finder/Desktop.svelte')).default,
    }).open();
  });
</script>

<GitCloner />

<main>
  <!-- <BootupScreen /> -->
  <TopBar />
  <Wallpaper />
  <WindowsArea />
  <Dock />
  <Toaster reversed={false} position="top-right" />
</main>

<style lang="scss">
  main {
    height: 100%;
    width: 100%;

    display: grid;
    grid-template-rows: auto 1fr auto;
  }
</style>
