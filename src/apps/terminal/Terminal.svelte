<script lang="ts">
  import { getContext, onMount } from 'svelte';

  import type { WindowAPI } from '__/stores/window.store';
  import TrafficLights from 'os/ui/Window/TrafficLights.svelte';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { TTY, Xterm } from 'os/kernel/kernel/tty';
  import { proxy } from 'comlink';
  import { DenoWorker } from 'os/deno/DenoWorker';
  import { DenoREPL } from './desh';
  import SQLiteWorker from './sqlite.worker?worker';
  import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
  let divEl: HTMLDivElement = null;

  onMount(() => {
    const worker = new DenoWorker();
    const terminal = new Xterm();
    const tty = new TTY(terminal);
    const shell = new DenoREPL(tty, worker.isolate);
    console.log('write file');

    (async () => {
      await worker.isolate.attach();
      console.log('write file');
      await worker.isolate.addEventListener(
        'stdout',
        proxy((ev) => {
          terminal.tty.println(ev.detail.join(' '));
        }),
      );
      console.log('write file');

      console.log(await WebAssembly.compileStreaming(fetch('/sqlite.wasm')));

      function init() {
        let worker = new SQLiteWorker();
        // This is only required because Safari doesn't support nested
        // workers. This installs a handler that will proxy creating web
        // workers through the main thread
        initBackend(worker);
      }

      init();

      await worker.isolate.Deno.writeTextFile(
        '/script.ts',
        `
        import { DB } from "https://raw.githubusercontent.com/devinci-os/deno-sqlite/31ba590c0730d670134cda712816865e353efd31/mod.ts";

// Open a database
(async () => {
  const db = await DB.create("http://localhost/sqlite.wasm", "test.db");
globalThis.db = db;
  console.log(db.query(\`
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT
)\`))
//   console.log(db.query(\`

// INSERT INTO people (name) VALUES('Deno')
// \`))
//   console.log(db.query(\`
// SELECT * FROM people
// \`));

})()


      `,
      );

      console.log('write file');

      await worker.isolate.run('/script.ts');

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
