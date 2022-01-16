import type * as monacoApi from 'monaco-editor.ts';
import {
  basicLanguages,
  knownBasicLanguages,
  knonwLanguageServices,
  languageServiceAliases,
} from './basic-languages.ts';
import { createPlugin, createRemotePlugin } from '../plugin-api.ts';

export const basicLanguagePlugins: {
  [k in typeof basicLanguages[number]]: monacoApi.plugin.IPlugin;
} = Object.fromEntries(
  basicLanguages.map((lang) => [
    lang,
    createPlugin({ name: 'language.' + lang }, async (monaco) => {
      if (knownBasicLanguages.includes(lang as any)) {
        await monaco.plugin.install(
          createRemotePlugin({
            name: 'language.' + lang + '.basic',
            dependencies: [],
            url: monaco.loader.languagesPath + `${lang}.basic.js`,
          }),
        );
      }

      if (knonwLanguageServices.includes(lang as any)) {
        await monaco.plugin.install(
          createRemotePlugin({
            name: 'language.' + lang + '.service',
            dependencies: [],
            url: monaco.loader.languagesPath + `${lang}.service.js`,
          }),
        );
      }

      if (languageServiceAliases[lang]) {
        await monaco.plugin.install(
          createRemotePlugin({
            name: 'language.' + languageServiceAliases[lang] + '.service',
            dependencies: [],
            url: monaco.loader.languagesPath + `${languageServiceAliases[lang]}.service.js`,
          }),
        );
      }
    }),
  ]),
) as unknown as any;
