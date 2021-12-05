import type * as monacoApi from 'monaco-editor';
import { endingSlash, noEndingSlash } from './utils';
import withPlugins from './plugin-api';
import languagesPlugin from './languages/register';
import themes from './themes';
import editors from './editors';
import shortcuts from './shortcuts';
import workers, { createBlobURL } from './workers';
import { createPlugin } from './plugin-api';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import version from './utils/version';

type Monaco = typeof monacoApi;

declare module 'monaco-editor' {
  export interface LoaderOptions {
    monacoPath: string;
    workersPath: string;
    languagesPath: string;
    monacoCorePkg: string;
    cdn: string;
    monacoVersion: string;
  }

  export let loader: LoaderOptions;
}

export interface CancellablePromise<T> extends Promise<T> {
  cancel: () => void;
}

const merge = (target: { [x: string]: any }, source: { [x: string]: any }) => {
  Object.keys(source).forEach((key) => {
    if (source[key] instanceof Object)
      target[key] && Object.assign(source[key], merge(target[key], source[key]));
  });
  return { ...target, ...source };
};

function cdnPath(root, pkg, version, path) {
  return `${endingSlash(root)}${pkg}@${version}${path}`;
}

export function loadMonaco(options: Partial<monacoApi.LoaderOptions>): CancellablePromise<Monaco> {
  const {
    monacoVersion = '0.30.1',
    monacoCorePkg = 'monaco-editor',
    cdn = 'https://cdn.jsdelivr.net/npm',
    monacoPath = endingSlash(cdnPath(cdn, monacoCorePkg, monacoVersion, '/')),
    workersPath = endingSlash(cdnPath(cdn, 'use-monaco', version, '/dist/workers/')),
    languagesPath = endingSlash(cdnPath(cdn, 'use-monaco', version, '/dist/languages/')),
  } = options;

  const loaderPlugin = createPlugin({ name: 'core.loader' }, (monaco) => {
    monaco.loader = {
      monacoCorePkg,
      monacoVersion,
      cdn,
      monacoPath: endingSlash(monacoPath),
      workersPath: endingSlash(workersPath),
      languagesPath: endingSlash(languagesPath),
    };
  });

  console.log('[monaco] loading monaco from', monacoPath, '...');

  const cancelable = monacoLoader.init({
    paths: { monaco: endingSlash(monacoPath), vs: endingSlash(monacoPath) + 'min/vs' },
    mode: 'esm',
  });

  let disposable: monacoApi.IDisposable;

  const promise: CancellablePromise<Monaco> = cancelable
    .then(async (monacoBase) => {
      let newApi = {};

      let monaco = new Proxy(monacoBase, {
        get(target, p, receiver) {
          // console.log('[monaco] get', p);
          return newApi[p] || target[p];
        },
        set(target, p, value, receiver) {
          // console.log('[monaco] set', p);

          newApi[p] = value;
          return true;
        },
      });

      console.log('[monaco] loaded monaco');
      monaco = withPlugins(monaco);

      disposable = await monaco.plugin.install(
        loaderPlugin,
        languagesPlugin,
        themes,
        editors,
        shortcuts,
        workers,
      );

      monaco.worker.setEnvironment({
        getWorker: (label) => {
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
          if (label === 'editorWorkerService') {
            return new editorWorker();
          }

          const workerSrc = this.workerClients[label].src;
          console.log(`[monaco] loading worker: ${label}`);
          if (typeof workerSrc === 'string') {
            var workerBlobURL = createBlobURL(`importScripts("${workerSrc}")`);
            return new Worker(workerBlobURL, {
              name: label,
            });
          } else {
            return workerSrc();
          }
        },
      });

      return monaco;
    })
    .catch((error) =>
      console.error('An error occurred during initialization of Monaco:', error),
    ) as any;

  promise.cancel = () => {
    cancelable.cancel?.();
    disposable?.dispose?.();
  };

  return promise;
}

const makeCancelable = function <T>(promise: Promise<T>): CancellablePromise<T> {
  let hasCanceled_ = false;
  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise.then((val) => (hasCanceled_ ? reject('operation is manually canceled') : resolve(val)));
    promise.catch((error) => reject(error));
  });
  const cancellablePromise = Object.assign(wrappedPromise, {
    cancel: () => (hasCanceled_ = true),
  });
  return cancellablePromise;
};

export class MonacoLoader {
  config: any;

  constructor() {
    this.config = {};
  }

  resolve: any;
  reject: any;

  injectScripts(script: HTMLScriptElement) {
    document.body.appendChild(script);
  }

  handleMainScriptLoad = () => {
    document.removeEventListener('monaco_init', this.handleMainScriptLoad);
    this.resolve((window as any).monaco);
  };

  createScript(src?: string) {
    const script = document.createElement('script');
    return src && (script.src = src), script;
  }

  createMonacoLoaderScript(mainScript: HTMLScriptElement) {
    const loaderScript = this.createScript(`${noEndingSlash(this.config.paths.vs)}/loader.js`);
    loaderScript.onload = () => this.injectScripts(mainScript);
    loaderScript.onerror = this.reject;
    return loaderScript;
  }

  createMainScript() {
    const mainScript = this.createScript();
    mainScript.innerHTML = `
      require.config(${JSON.stringify(this.config)});
      require(['vs/editor/editor.main'], function() {
        document.dispatchEvent(new Event('monaco_init'));
      });
    `;
    mainScript.onerror = this.reject;
    return mainScript;
  }

  isInitialized = false;

  wrapperPromise = new Promise<Monaco>((res, rej) => {
    this.resolve = res;
    this.reject = rej;
  });

  init(config: any): CancellablePromise<Monaco> {
    if (!this.isInitialized) {
      //@ts-ignore
      if (window.monaco && window.monaco.editor) {
        //@ts-ignore
        return new Promise((res, rej) => res(window.monaco));
      }
      this.config = merge(this.config, config);
      this.loadAMDMonacoFromCDN();
      // this.loadESM();
    }

    this.isInitialized = true;
    return makeCancelable(this.wrapperPromise);
  }

  async loadESM() {
    const monaco = await import('monaco-editor-core');
    this.resolve(monaco);
  }

  private loadAMDMonacoFromCDN() {
    document.addEventListener('monaco_init', this.handleMainScriptLoad);
    const mainScript = this.createMainScript();
    const loaderScript = this.createMonacoLoaderScript(mainScript);
    this.injectScripts(loaderScript);
  }
}

export const monacoLoader = new MonacoLoader();
