<script lang="ts">
  import { setContext } from 'svelte';

  import type { InitializeMonacoOptions } from '../monaco/monaco';

  export let theme: InitializeMonacoOptions['theme'] = undefined;
  export let themes: InitializeMonacoOptions['themes'] = undefined;

  $: {
    if (!!theme && monaco) {
      let themeToSet = typeof theme === 'function' ? theme() : theme;

      if (typeof themeToSet === 'string' || !('then' in themeToSet)) {
        monaco.editor.setTheme(themeToSet);
      } else {
        themeToSet.then(monaco.editor.setTheme);
      }
    }
  }

  export let monaco: typeof import('monaco-editor');

  setContext('monaco', monaco);

  $: {
    if (!!themes && monaco) {
      monaco.editor.defineThemes(themes);
    }
  }
</script>

<slot {monaco} />
