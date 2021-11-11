<script lang="ts">
  import { getContext, onMount } from 'svelte';

  import { Terminal } from 'xterm';
  import 'xterm/css/xterm.css';
  import { WebLinksAddon } from 'xterm-addon-web-links';
  import type { WindowAPI } from '__/stores/window.store';
  import TrafficLights from 'os/ui/Window/TrafficLights.svelte';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { PTYMasterFile, TTY } from 'os/kernel/kernel/tty';

  let divEl: HTMLDivElement = null;

  onMount(() => {
    const terminal = new Terminal({});
    // Load WebLinksAddon on terminal, this is all that's needed to get web links
    // working in the terminal.
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(divEl);

    let file = new TTY(terminal);
  });

  export let args;

  const win = getContext('windowAPI') as WindowAPI;
</script>

<div class="h-full flex flex-col overflow-hidden">
  <div
    class="h-8 editor-header app-window-drag-handle relative flex flex-row items-center justify-center"
  >
    <div class="tl-container vscode">
      <TrafficLights
        on:green-light={(e) => {}}
        on:red-light={(e) => {
          win.close();
        }}
      >
        <ExpandSvg slot="green-light" />
      </TrafficLights>
    </div>

    <div class="i-vscode-icons-file-type-vscode mr-3" />
    <div class="font-bold">{'/jsh'}</div>
  </div>
  <div class="flex-1"><div class="h-full"><div bind:this={divEl} class="h-full" /></div></div>
</div>

<style lang="scss">
  .editor-header {
    background: #ffffff;
    backdrop-filter: blur(10px);
  }

  .tl-container.vscode {
    top: 0.5rem;
    position: absolute;
    left: 1rem;
  }
</style>
