<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type * as monacoApi from 'monaco-editor';
  import { fixPath } from '../monaco/utils/path';
  import { getMonacoModel } from '../monaco/text_model';

  export let path: string;
  export let language = undefined;
  export let monaco: typeof monacoApi;
  export let value = undefined;
  export let options: monacoApi.editor.IEditorOptions;
  export let defaultValue = value ?? '';
  let resolvedValue = value ?? defaultValue;
  let monacoEditor: monacoApi.editor.IStandaloneCodeEditor;
  let disposables = [];
  export let model: monacoApi.editor.ITextModel = null;

  const dispatch = createEventDispatcher();

  const editor = (
    node: HTMLDivElement,
    options: {
      path: string;
      language: string;
      value: string;
    },
  ) => {
    let modelPath = fixPath(
      path ??
        `model${
          (monaco?.languages.getLanguages().find((l) => l.id === language)
            ?.extensions?.[0] as any) ?? '.js'
        }`,
    );

    model = model ?? getMonacoModel(monaco, modelPath, options.value, options.language);

    monacoEditor = monaco.editor.create(node, {
      model: model,
      ...options,
    });

    dispatch('mount', {
      editor: monacoEditor,
    });

    disposables.push(
      monacoEditor.onDidChangeModelContent((v) => {
        dispatch('change', {
          value: monacoEditor.getValue(),
        });
      }),
    );

    disposables.push(monacoEditor);

    return {
      destroy() {
        disposables.forEach((d) => d.dispose());
      },
      update(args) {
        model = getMonacoModel(monaco, modelPath, args.value, args.language);
        if (args.value !== model.getValue()) {
          resolvedValue = args.value;
          model.pushEditOperations(
            [],
            [
              {
                range: model.getFullModelRange(),
                text: resolvedValue,
              },
            ],
            () => null,
          );
        }

        monaco.editor.setModelLanguage(model, args.language);

        if (monacoEditor.getModel() !== model) {
          monacoEditor.setModel(model);
        }
      },
    };
  };

  $: {
    if (model) {
    }
  }
</script>

<div
  class="h-full"
  use:editor={{
    path: path,
    value: resolvedValue,
    language: language,
  }}
/>
