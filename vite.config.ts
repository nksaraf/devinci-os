import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { prefetch } from './prefetch-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import replace from '@rollup/plugin-replace';
import Unocss from 'unocss/vite';
import { presetUno, presetAttributify } from 'unocss';
import presetIcons from '@unocss/preset-icons';
import { dynamicImport } from 'vite-plugin-dynamic-import';
import UnpluginIcons from 'unplugin-icons/vite';

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
    alias: {
      '__/stores': new URL('./src/stores/', import.meta.url).pathname,
      __: new URL('./packages/macos-ui/src/', import.meta.url).pathname,
      '@ui': new URL('./packages/macos-ui/src/', import.meta.url).pathname,
      os: new URL('./src/', import.meta.url).pathname,
    },
  },
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['./'],
    },
  },
  assetsInclude: ['packages/macos-ui/public'],
  build: {
    minify: 'terser',
  },
});
