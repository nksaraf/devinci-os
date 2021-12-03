<script lang="ts">
  import { getContext, onMount } from 'svelte';

  import type { WindowAPI } from '__/stores/window.store';
  import TrafficLights from 'os/macos/ui/Window/TrafficLights.svelte';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { Xterm } from '$lib/xterm';
  import { proxy } from 'os/lib/comlink/mod';
  import { createResourceTable } from 'os/lib/denix/types';
  import { FileResource } from 'os/lib/denix/ops/fs.ops';
  import type { TTY } from 'os/lib/tty/tty';
  import { fs } from '$lib/fs';

  let divEl: HTMLDivElement = null;

  onMount(() => {
    const terminal = new Xterm();

    (async () => {
      debugger;
      const tty = (await fs.open('/dev/tty1', 1, 0x666)) as TTY;
      tty.connect(terminal);

      const resourceTable = createResourceTable();
      resourceTable[0] = new FileResource(tty, 'tty1');
      resourceTable[1] = new FileResource(tty, 'tty1');
      resourceTable[2] = new FileResource(tty, 'tty1');
      navigator.process
        .spawn({
          tty: proxy(tty),
          cmd: ['deno', 'run', '/src/lib/desh/src/crsh.js'],
          cwd: '/lib/deno',
          resourceTable,
        })
        .then(async (process) => {
          terminal.open(divEl);
        });
    })();
  });

  export let args;

  const win = getContext('windowAPI') as WindowAPI;
</script>

<div class="h-full flex flex-col overflow-hidden">
  <div
    class="h-8 editor-header {win.dragHandleClass} relative flex flex-row items-center justify-center"
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
