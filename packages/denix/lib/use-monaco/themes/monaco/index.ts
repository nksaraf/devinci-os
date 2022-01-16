import ayuLight from './ayu-light.ts';
import ayuDark from './ayu-dark.ts';
import ocean from './ocean.ts';

import monacoThemes from './monaco-themes.ts';

const allThemes = {
  ocean: ocean,
  'ayu-light': ayuLight,
  'ayu-dark': ayuDark,
  ...monacoThemes,
};

export type ThemeNames = keyof typeof allThemes;

export default allThemes;

export const themeNames: { [key: string]: string } = {};

Object.keys(allThemes).forEach((theme) => {
  themeNames[toTitleCase(theme)] = theme;
});

function toTitleCase(str: string) {
  return str
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/(?:^|[\s])\w/g, function (match: string) {
      return match.toUpperCase();
    })
    .replace(' Theme', '');
}
