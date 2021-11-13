<script lang="ts">
  import { getContext, onMount } from 'svelte';
  // import fs from 'os/kernel/fs';
  import TrafficLights from 'os/ui/Window/TrafficLights.svelte';
  import type { WindowAPI } from '__/stores/window.store';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { createVSCode } from 'vs/devinci/workbench';

  let divEl: HTMLDivElement = null;
  let editor: monaco.editor.IStandaloneCodeEditor;
  let Monaco: typeof monaco;

  export let args;

  console.log(args);

  const fs = getContext('kernel');

  onMount(async () => {
    // @ts-ignore
    // self.MonacoEnvironment = {
    //   getWorker: function (_moduleId: any, label: string) {
    //     if (label === 'json') {
    //       return new jsonWorker();
    //     }
    //     if (label === 'css' || label === 'scss' || label === 'less') {
    //       return new cssWorker();
    //     }
    //     if (label === 'html' || label === 'handlebars' || label === 'razor') {
    //       return new htmlWorker();
    //     }
    //     if (label === 'typescript' || label === 'javascript') {
    //       return new tsWorker();
    //     }
    //     return new editorWorker();
    //   },
    // };

    // Monaco = await import('monaco-editor');

    function writeFile(e) {
      kernel.fs.writeFile(args.path, editor.getValue(), 'utf8', 'w', 0x777, console.log);
    }

    let disposables = [];

    // let dat /da = kernel.fs.readFileSync(args.path, 'utf8', 'r');
    createVSCode(divEl, {});

    return () => {
      disposables.forEach((d) => d.dispose());
      editor.dispose();
    };
  });

  const win = getContext('windowAPI') as WindowAPI;
</script>

<div class="h-full flex flex-col overflow-hidden">
  <div class="editor-header relative app-window-drag-handle">
    <div class="file-header flex flex-row items-center justify-center w-full">
      <div class="i-vscode-icons-file-type-vscode mr-3" />
      <div class="font-bold text-base">{args.path}</div>
    </div>
    <div class="vscode-tl">
      <TrafficLights
        on:green-light={(e) => {
          win.maximize();
        }}
        on:red-light={(e) => {
          win.close();
        }}
      >
        <ExpandSvg slot="green-light" />
      </TrafficLights>
    </div>
  </div>
  <div class="flex-1">
    <div class="h-full bg-white"><div bind:this={divEl} class="h-full" /></div>
  </div>
</div>

<style lang="scss">
  .editor-header {
    background: #ffffff;
    backdrop-filter: blur(10px);
    height: 32px;
  }

  .file-header {
    background: #ffffff;
    backdrop-filter: blur(10px);
    height: 32px;
  }

  .vscode-tl {
    top: 0.5rem;
    position: absolute;
    left: 1rem;
  }
</style>
