<script lang="ts">
  import { getContext, onMount } from 'svelte';

  import type { WindowAPI } from '__/stores/window.store';
  import TrafficLights from 'os/macos/ui/Window/TrafficLights.svelte';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { TTY } from '$lib/tty';
  import { Xterm } from '$lib/xterm';
  let divEl: HTMLDivElement = null;
  import { parse } from 'https://deno.land/std@0.116.0/flags/mod.ts';

  async function shell(tty) {
    let data = await tty.lineDiscipline.prompt('> ');

    let { _ } = parse(data.split(' '));
    let cmd = _[0];

    switch (cmd) {
      case 'help':

      case 'ls':
        for await (let entry of Deno.readDir('.')) {
          tty.println(entry.name);
        }
      default:
        tty.println('command not found: ' + cmd);
    }
  }

  onMount(() => {
    // const worker = new DenixWorker(isolate.kernel);

    const terminal = new Xterm();
    const tty = new TTY();

    tty.connect(terminal);

    // Deno.run({
    //   cmd: ['deno', 'run', '/src/lib/desh/src/crsh.js'],
    //   stdin: 'piped',
    //   stdout: 'inherit',
    //   stderr: 'inherit',
    // });
    shell(tty).catch(console.error);

    terminal.open(divEl);
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
