import { svelte } from '@sveltejs/vite-plugin-svelte';
import { Alias, defineConfig } from 'vite';
import replace from '@rollup/plugin-replace';
import Unocss from 'unocss/vite';
import { presetUno, presetAttributify } from 'unocss';
import presetIcons from '@unocss/preset-icons';
import { dynamicImport } from 'vite-plugin-dynamic-import';
import UnpluginIcons from 'unplugin-icons/vite';
import path from 'path';
import resolve from '@rollup/plugin-node-resolve';

let basePath = path.resolve(__dirname);
console.log(basePath);
import { asc } from './build/rollup-plugin-asc';

const replacePlugin = () => {
  console.log(`process.env.VITE_LOCAL_BUILD=${process.env.VITE_LOCAL_BUILD === 'true'}`);
  if (process.env.VITE_LOCAL_BUILD === 'true') {
    return {
      __DATE__: new Date().toISOString(),
    };
  }
  return {};
};

const responseHeaders = () => {
  return {
    name: 'configure-response-headers',
    configureServer: (server) => {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        // res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        next();
      });
    },
  };
};

export default defineConfig({
  plugins: [
    asc({}),
    Unocss({
      include: ['**/*.svelte'],
      presets: [
        presetIcons({
          prefix: 'i-',
        }),
        presetAttributify({
          /* preset options */
        }),
        presetUno(),
      ],
    }),
    responseHeaders(),
    UnpluginIcons({ autoInstall: true, compiler: 'svelte' }),
    dynamicImport(),
    svelte(),
    // prefetch(),
    replace({ ...replacePlugin() }),
  ],
  resolve: {
    alias: [
      {
        find: /^vs\/css\!(.*)/,
        replacement: '$1.css',
        customResolver: resolve({
          extensions: ['.css'],
        }),
      },
      { find: 'vs/base/common/marked/marked', replacement: 'marked' },
      { find: 'vs/base/browser/dompurify/dompurify', replacement: 'dompurify' },
      { find: 'vs', replacement: new URL('./packages/vscode/src/vs/', import.meta.url).pathname },
      {
        find: '__/stores',
        replacement: new URL('./src/macos/stores/', import.meta.url).pathname,
      },
      { find: '__', replacement: new URL('./packages/macos-ui/src/', import.meta.url).pathname },
      { find: '@ui', replacement: new URL('./packages/macos-ui/src/', import.meta.url).pathname },
      {
        find: 'path',
        replacement: 'path-browserify',
      },
      { find: 'os', replacement: new URL('./src/', import.meta.url).pathname },
      {
        find: 'comlink',
        replacement: new URL('./src/lib/comlink/index.ts', import.meta.url).pathname,
      },
      { find: '$lib', replacement: new URL('./src/lib/', import.meta.url).pathname },
    ] as Alias[],
  },
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['./'],
    },
  },
  assetsInclude: ['packages/macos-ui/public/**/*', ''],
  build: {
    minify: 'terser',
  },
  optimizeDeps: {
    include: [
      './node_modules/readable-stream/readable-browser.js',
      './node_modules/debug/src/browser.js',
      // './src/deno/denix/deno-sw.ts'
    ],
  },
});
