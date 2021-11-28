<script lang="ts">
  import { getContext, onMount } from 'svelte';

  import type { WindowAPI } from '__/stores/window.store';
  import TrafficLights from 'os/macos/ui/Window/TrafficLights.svelte';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { TTY, Xterm } from 'os/lib/tty';
  import { proxy } from 'comlink';
  import { DenixWorker } from 'os/lib/deno/worker';
  import { isolate } from 'os/lib/deno/window';
  import { Desh } from './desh';
  let divEl: HTMLDivElement = null;

  onMount(() => {
    const worker = new DenixWorker(isolate.kernel);
    const terminal = new Xterm();
    const tty = new TTY();
    const shell = new Desh(tty, worker.isolate);

    (async () => {
      await worker.ready();
      await worker.isolate.kernel.addEventListener(
        'stdout',
        proxy((ev) => {
          terminal.tty.print(typeof ev.detail === 'string' ? ev.detail : ev.detail.join(' '));
        }),
      );

      tty.device.addEventListener('data', (event) => {
        shell.handleTermData(event.detail);
      });

      await worker.isolate.run('/src/lib/desh/src/crsh.js');
      // console.log(await worker.isolate.run('https://deno.land/std@0.115.1/http/file_server.ts'));

      // console.log(await worker.isolate.run('/src/scripts/git-init.ts'));
      // await shell.start();
    })();

    terminal.open(divEl);
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
  <div class="flex-1 bg-black">
    <div class="h-full"><div bind:this={divEl} class="h-full" /></div>
  </div>
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
