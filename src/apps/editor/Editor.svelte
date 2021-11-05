<script lang="ts">
  import type * as monaco from 'monaco-editor';
  import { onMount } from 'svelte';
  import editorWorker from '../../node_modules/monaco-editor/esm/vs/editor/editor.worker?worker';
  import jsonWorker from '../../node_modules/monaco-editor/esm/vs/language/json/json.worker?worker';
  import cssWorker from '../../node_modules/monaco-editor/esm/vs/language/css/css.worker?worker';
  import htmlWorker from '../../node_modules/monaco-editor/esm/vs/language/html/html.worker?worker';
  import tsWorker from '../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker?worker';

  let divEl: HTMLDivElement = null;
  let editor: monaco.editor.IStandaloneCodeEditor;
  let Monaco: typeof monaco;

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
    editor = Monaco.editor.create(divEl, {
      value: ['function x() {', '\tconsole.log("Hello world!");', '}'].join('\n'),
      language: 'javascript',
    });

    return () => {
      editor.dispose();
    };
  });
</script>

<div bind:this={divEl} class="h-screen" />
