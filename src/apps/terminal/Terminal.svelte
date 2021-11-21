<script lang="ts">
  import { getContext, onMount } from 'svelte';

  import 'xterm/css/xterm.css';
  import { WebLinksAddon } from 'xterm-addon-web-links';
  import { WebglAddon } from 'xterm-addon-webgl';
  import { FitAddon } from 'xterm-addon-fit';
  import type { WindowAPI } from '__/stores/window.store';
  import TrafficLights from 'os/ui/Window/TrafficLights.svelte';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { TTYDevice, TTY, Xterm } from 'os/kernel/kernel/tty';
  import DenoWebWorker from 'os/deno/deno-worker?worker';
  import { wrap, proxy } from 'comlink';
  import type { DenoWorker } from 'os/deno/deno-worker';
  import { Terminal } from 'os/kernel/terminal';

  let divEl: HTMLDivElement = null;

  onMount(() => {
    const terminal = new Terminal();
    const worker = wrap<DenoWorker>(new DenoWebWorker());

    (async () => {
      // let channel = await worker.connect();
      await worker.init();
      await worker.addEventListener(
        'stdout',
        proxy((ev) => {
          terminal.tty.println(ev.detail.join(' '));
        }),
      );

      terminal.shell.handleCommand = async (cmd) => {
        try {
          console.log(await worker.eval(cmd));
        } catch (e) {
          terminal.tty.print(e.message + '\n' + e.stack);
        }
        terminal.tty.println('');
      };

      await terminal.shell.start();

      // for (var input of shell.getReadable()))

      // while (true) {
      //   console.log(await tty.writeString('> '));
      //   console.log('waiting for input');
      //   let input = await tty.readString();
      //   console.log(input);
      //   try {
      //     console.log(await worker.eval(input));
      //   } catch (e) {
      //     await tty.writeString(e.message + '\r\n' + e.stack.replaceAll('\n', '\r\n'));
      //   }
      // }
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
