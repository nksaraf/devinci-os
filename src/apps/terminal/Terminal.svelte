<script lang="ts">
  import { getContext, onMount } from 'svelte';

  import type { WindowAPI } from '__/stores/window.store';
  import TrafficLights from 'os/ui/Window/TrafficLights.svelte';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { TTY, Xterm } from 'os/kernel/kernel/tty';
  import { proxy } from 'comlink';
  import { DenoWorker } from 'os/deno/DenoWorker';
  import { Desh } from './desh';
  let divEl: HTMLDivElement = null;

  import { getWAPMUrlForCommandName } from './wapm';

  onMount(() => {
    const worker = new DenoWorker();

    const terminal = new Xterm();
    const tty = new TTY(terminal);
    const shell = new Desh(tty, worker.isolate);

    (async () => {
      await worker.ready();
      await worker.isolate.kernel.addEventListener(
        'stdout',
        proxy((ev) => {
          terminal.tty.print(typeof ev.detail === 'string' ? ev.detail : ev.detail.join(' '));
        }),
      );

      await worker.isolate.run(await getWAPMUrlForCommandName('exa'));

      // await worker.Deno.writeTextFile('/script.ts', scriptURL);
      // await worker.isolate.run('/script.ts');

      tty.device.addEventListener('data', (event) => {
        shell.handleTermData(event.detail);
      });

      await shell.start();
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
