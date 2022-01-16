<script lang="ts">
  import { getContext, onMount } from 'svelte';

  import type { WebViewAPI } from '__/stores/window.store';
  import TrafficLights from 'os/macos/ui/Window/TrafficLights.svelte';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { Xterm } from '$lib/xterm';
  import type { SharedFile } from '$lib/fs/shared';
  import type { TTY } from 'os/lib/tty/tty';

  let divEl: HTMLDivElement = null;

  onMount(() => {
    (async () => {
      let i = Math.floor(Math.random() * 100);

      const tty = ((await navigator.process.fs.open(`/dev/tty${i}`, 1, 0o666)) as SharedFile)
        .file as TTY;
      const f = await Deno.open(`/dev/tty${i}`, { write: true });

      const xterm = new Xterm();
      tty.connect(xterm);
      xterm.open(divEl);

      let process = Deno.run({
        cmd: ['terminal'],
        cwd: '/lib/deno',
        stdin: f.rid,
        stdout: f.rid,
        stderr: f.rid,
      });

      console.log(await process.status());
    })();
  });

  export let args;

  const win = getContext('windowAPI') as WebViewAPI;
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
