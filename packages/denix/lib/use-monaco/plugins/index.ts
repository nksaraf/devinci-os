import { default as prettier } from './prettier.ts';
import { default as graphql } from './graphql.ts';
import { default as typings } from './typings.ts';
import { default as vscodeThemes } from './vscode-themes.ts';
import { default as textmate } from './textmate.ts';

export const pluginMap = {
  prettier: prettier,
  graphql: graphql,
  typings: typings,
  'vscode-themes': vscodeThemes,
  textmate: textmate,
};

export { prettier, graphql, typings, vscodeThemes, textmate };
