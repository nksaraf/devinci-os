import { svelte } from '@sveltejs/vite-plugin-svelte';
import { Alias, defineConfig } from 'vite';
import { prefetch } from './prefetch-plugin';
import { VitePWA } from 'vite-plugin-pwa';
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
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          // res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          next();
        });
      },
    },
    UnpluginIcons({ autoInstall: true, compiler: 'svelte' }),
    dynamicImport(),
    svelte(),
    prefetch(),
    replace({ ...replacePlugin() }),
    VitePWA({
      includeAssets: [
        'robots.txt',
        'assets/app-icons/finder/32.png',
        'assets/cover-image.png',
        'assets/cursors/(normal|link|text|help)-select.svg',
        'assets/**/*.mp3',
        'assets/**/*.webp',
        'assets/wallpapers/37-[12].jpg',
      ],
      manifest: {
        name: 'Devinci OS',
        short_name: 'macOS Svelte',
        theme_color: '#ffffff',
        description: 'Devinci OS',
        icons: [
          {
            src: 'assets/app-icons/finder/128.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: 'assets/app-icons/finder/192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'assets/app-icons/finder/256.png',
            sizes: '256x256',
            type: 'image/png',
          },
          {
            src: 'assets/app-icons/finder/512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'assets/app-icons/finder/512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/github1s.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'github1s-api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
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
      { find: '__/stores', replacement: new URL('./src/stores/', import.meta.url).pathname },
      { find: '__', replacement: new URL('./packages/macos-ui/src/', import.meta.url).pathname },
      { find: '@ui', replacement: new URL('./packages/macos-ui/src/', import.meta.url).pathname },
      {
        find: 'path',
        replacement: new URL('./src/kernel/path/path.ts', import.meta.url).pathname,
      },
      { find: 'os', replacement: new URL('./src/', import.meta.url).pathname },
      {
        find: 'comlink',
        replacement: new URL('./src/deno/comlink/index.ts', import.meta.url).pathname,
      },
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
  esbuild: {
    // banner: `let require = {
    // 	toUrl: (s) => {
    // 		let meta = import.meta
    // 		// if (s.length > 0 && typeof global !== 'undefined') {
    // 		// 	try {
    // 		// 		console.log(global.require.resolve(s))
    // 		// 	} catch (e) {
    // 		// 		console.log('ERROR', e)
    // 		// 	}
    // 		// }
    // 		if (s === 'bootstrap-fork') {
    // 			return "${basePath}/src/bootstrap-vite-fork.js"
    // 		}
    // 		return "${basePath}/" + (s.length === 0 ? 'package.json' : s);
    // 	},
    // 	__$__nodeRequire: import.meta.env.SSR ? ((...args) => global.require(...args)) : undefined
    // };`,
  },
  optimizeDeps: {
    include: ['./node_modules/readable-stream/readable-browser.js'],
  },
});
