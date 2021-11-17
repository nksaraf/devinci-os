<script lang="ts">
  import type * as monaco from 'monaco-editor';
  import { getContext, onDestroy, onMount } from 'svelte';
  import editorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker?worker';
  import jsonWorker from '../../../node_modules/monaco-editor/esm/vs/language/json/json.worker?worker';
  import cssWorker from '../../../node_modules/monaco-editor/esm/vs/language/css/css.worker?worker';
  import htmlWorker from '../../../node_modules/monaco-editor/esm/vs/language/html/html.worker?worker';
  import tsWorker from '../../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker?worker';
  // import fs from 'os/kernel/fs';
  import TrafficLights from 'os/ui/Window/TrafficLights.svelte';
  import type { WindowAPI } from '__/stores/window.store';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';
  import { constants } from 'os/kernel/kernel/constants';
  let divEl: HTMLDivElement = null;
  let editor: monaco.editor.IStandaloneCodeEditor;
  let Monaco: typeof monaco;

  export let args;

  console.log(args);

  const fs = getContext('kernel');

  let disposables = [];

  onMount(async () => {
    // @ts-ignore
    self.MonacoEnvironment = {
      getWorker: function (_moduleId: any, label: string) {
        if (label === 'json') {
          return new jsonWorker();
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
          return new cssWorker();
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
          return new htmlWorker();
        }
        if (label === 'typescript' || label === 'javascript') {
          return new tsWorker();
        }
        return new editorWorker();
      },
    };

    Monaco = await import('monaco-editor');

    function writeFile(e) {
      kernel.fs.writeFile(
        args.path,
        editor.getValue(),
        'utf8',
        constants.fs.O_RDWR,
        0x777,
        console.log,
      );
    }

    let data = kernel.fs.readFileSync(args.path, 'utf8', constants.fs.O_RDWR);
    editor = Monaco.editor.create(divEl, {
      value: data as string,
      fontSize: 14,
      theme: 'vs-light',
      cursorStyle: 'line-thin',
      automaticLayout: true,
    });

    disposables.push(editor.onDidChangeModelContent(writeFile));
    disposables.push(editor);
  });

  onDestroy(() => {
    disposables.forEach((d) => d.dispose());
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
