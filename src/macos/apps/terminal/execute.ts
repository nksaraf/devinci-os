/// <reference path="../../types/deno-types.d.tss.d.ts

import { DB } from 'https://raw.githubusercontent.com/devinci-os/deno-sqlite/31ba590c0730d670134cda712816865e353efd31/mod.ts';
import schema from 'https://raw.githubusercontent.com/withfig/autocomplete/master/src/deno.ts';
import { prettyBytes } from 'https://deno.land/std@0.115.1/fmt/bytes.ts';
import { Table } from 'https://raw.githubusercontent.com/c4spar/deno-cliffy/v0.16.0/table/mod.ts';
import Context from 'https://deno.land/std@0.115.1/wasi/snapshot_preview1.ts';

Deno.stdout.write(new TextEncoder().encode('Hello World!'));

import {
  bgBlue,
  bgRgb24,
  bgRgb8,
  bold,
  italic,
  red,
  rgb24,
  rgb8,
  green,
} from 'https://deno.land/std@0.115.1/fmt/colors.ts';

console.log(bgBlue(italic(red(bold('Hello, World!')))));

// also supports 8bit colors

console.log(rgb8('Hello, World!', 42));

console.log(bgRgb8('Hello, World!', 42));

// and 24bit rgb

console.log(
  rgb24('Hello, World!', {
    r: 41,
    g: 42,
    b: 43,
  }),
);

console.log(
  bgRgb24('Hello, World!', {
    r: 41,
    g: 42,
    b: 43,
  }),
);

console.log(prettyBytes(1337));
//=> '1.34 kB'

console.log(prettyBytes(100));
//=> '100 B'

// Display with units of bits
console.log(prettyBytes(1337, { bits: true }));
//=> '1.34 kbit'

// Display file size differences
console.log(prettyBytes(42, { signed: true }));
//=> '+42 B'

// Localized output using German locale
console.log(prettyBytes(1337, { locale: 'de' }));
//=> '1,34 kB'

const table: Table = new Table(
  ['Row 1 Column 1', 'Row 1 Column 2', 'Row 1 Column 3'],
  ['Row 2 Column 1', 'Row 2 Column 2', 'Row 2 Column 3'],
  ['Row 3 Column 1', 'Row 3 Column 2', 'Row 3 Column 3'],
);

console.log(table.toString());

// (async () => {
//   for await (const file of Deno.readDir('/')) {
//     if (file.isDirectory) {
//       console.log(green(file.name));
//     } else {
//       console.log(file.name);
//     }
//   }
// })();

const context = new Context({
  args: Deno.args,
  env: Deno.env.toObject(),
});

const binary = await fetch('path/to/your/module.wasm');
const module = await WebAssembly.compile(binary);
const instance = await WebAssembly.instantiate(module, {
  wasi_snapshot_preview1: context.exports,
});

context.start(instance);
