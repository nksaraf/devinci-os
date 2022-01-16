import type * as monacoApi from 'monaco-editor.ts';

import { asDisposable, loadMonaco, basicLanguagePlugins } from '..ts';
import { pluginMap } from '../plugins.ts';

type Monaco = typeof monacoApi;

declare global {
  interface Window {
    monaco: Monaco;
  }
}

type PromiseOrNot<T> = Promise<T> | T;

export interface InitializeMonacoOptions
  extends Partial<Omit<monacoApi.LoaderOptions, 'plugins' | 'languages'>> {
  onLoad?: (
    monaco: typeof monacoApi,
  ) => PromiseOrNot<monacoApi.IDisposable | monacoApi.IDisposable[] | void | undefined>;
  themes?: any;
  defaultEditorOptions?: monacoApi.editor.IEditorOptions;
  plugins?: (keyof typeof pluginMap | [keyof typeof pluginMap, any] | monacoApi.plugin.IPlugin)[];
  languages?: (
    | keyof typeof basicLanguagePlugins
    | [keyof typeof basicLanguagePlugins, any]
    | monacoApi.plugin.IPlugin
  )[];
  onThemeChange?: (theme: any, monaco: typeof monacoApi) => PromiseOrNot<void>;
  theme?:
    | string
    | monacoApi.editor.IStandaloneThemeData
    | (() => PromiseOrNot<monacoApi.editor.IStandaloneThemeData>);
}

export const monacoLoader: monacoApi.IDisposable & {
  monaco?: Monaco;
  promise: Promise<typeof monacoApi>;
} = {
  dispose: () => {},
  monaco: undefined,
  promise: null,
};

export function initializeMonaco({
  plugins = [],
  languages = [],
}: // ...loaderOptions
InitializeMonacoOptions) {
  let disposables = [];
  if (monacoLoader.promise) {
    return monacoLoader;
  }

  async function initialize() {
    // Load monaco if necessary.
    if (monacoLoader.monaco === undefined) {
      monacoLoader.monaco = await loadMonaco({});
    }

    // Load plugins
    await monacoLoader.monaco.plugin
      .install(...getPlugins(plugins, languages as any))
      .then((d) => disposables.push(asDisposable(d)));

    // @ts-expect-error
    window.monaco = monacoLoader.monaco;
    return monacoLoader.monaco;
  }

  monacoLoader.promise = initialize();
  monacoLoader.dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return monacoLoader;
}

function getPlugins(
  plugins: InitializeMonacoOptions['plugins'],
  languages: InitializeMonacoOptions['languages'],
) {
  return [
    ...plugins
      .map((plug) =>
        typeof plug === 'string' || (Array.isArray(plug) && plug.length === 2)
          ? pluginMap[Array.isArray(plug) ? plug[0] : plug]
            ? pluginMap[Array.isArray(plug) ? plug[0] : plug](Array.isArray(plug) ? plug[1] : {})
            : undefined
          : plug,
      )
      .filter(Boolean),
    ...(languages as (string | [string, any] | monacoApi.plugin.IPlugin)[])
      .map((plug) =>
        typeof plug === 'string'
          ? basicLanguagePlugins[plug]
            ? basicLanguagePlugins[plug]
            : undefined
          : plug,
      )
      .filter(Boolean),
  ];
}
