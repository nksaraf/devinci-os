<script lang="ts">
  import { getContext } from 'svelte';

  // import fs from 'os/kernel/fs';
  import TrafficLights from 'os/macos/ui/Window/TrafficLights.svelte';
  import type { WebViewAPI } from '__/stores/window.store';
  import ExpandSvg from '@ui/components/SVG/traffic-lights/ExpandSVG.svelte';

  import { initializeMonaco } from '$lib/use-monaco/monaco/monaco';
  import MonacoEditor from '$lib/use-monaco/svelte/MonacoEditor.svelte';
  export let args;

  const win = getContext('windowAPI') as WebViewAPI;

  async function writeFile(value) {
    await Deno.writeTextFile(args.path, value);
  }
</script>

<div class="h-full flex flex-col overflow-visible">
  <div class="editor-header relative {win.dragHandleClass}">
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
    <div class="h-full bg-white">
      {#await Promise.all( [initializeMonaco( { plugins: ['typings', 'prettier'] }, ).promise, Deno.readTextFile(args.path)], )}
        <div>Loading monaco</div>
      {:then [monaco, text]}
        <MonacoEditor
          {monaco}
          options={{
            formatOnSave: true, // a
          }}
          path={args.path}
          value={text}
          on:change={(e) => writeFile(e.detail)}
        />
      {:catch err}
        <div class="error">
          Failed to load monaco editor: {err.message}
        </div>
        <pre>
        {err.stack}
      </pre>
      {/await}
    </div>
  </div>
</div>

<style lang="scss">
  .editor-header {
    height: 32px;
  }

  .file-header {
    background-color: #ffffffaa;
    backdrop-filter: blur(10px);
    height: 32px;
    border-top-left-radius: 0.75rem;
    border-top-right-radius: 0.75rem;
  }

  .vscode-tl {
    top: 0.5rem;
    position: absolute;
    left: 1rem;
  }
</style>
