#! /usr/bin/env deno run --allow-read --compat --unstable
import * as fs from 'fs.ts';
import * as path from 'path.ts';

const symLinks: { [dev: number]: { [ino: number]: boolean } } = {};
const ignoreFiles = ['.git', 'node_modules', 'bower_components', 'build'];

type FileTree = { [name: string]: FileTree | null };

function rdSync(dpath: string, tree: FileTree, name: string): FileTree {
  const files = fs.readdirSync(dpath);
  files.forEach((file) => {
    // ignore non-essential directories / files
    if (ignoreFiles.indexOf(file) !== -1 || file[0] === '.') {
      return;
    }
    const fpath = `${dpath}/${file}`;
    try {
      // Avoid infinite loops.
      const lstat = fs.lstatSync(fpath);
      let key = lstat.dev as number;
      if (lstat.isSymbolicLink()) {
        if (!symLinks[key]) {
          symLinks[key] = {};
        }
        // Ignore if we've seen it before
        if (symLinks[key][lstat.ino as number]) {
          return;
        }
        symLinks[key][lstat.ino as number] = true;
      }
      const fstat = fs.statSync(fpath);
      if (fstat.isDirectory()) {
        const child = (tree[file] = {});
        rdSync(fpath, child, file);
      } else {
        tree[file] = null;
      }
    } catch (e) {
      // Ignore and move on.
    }
  });
  return tree;
}

const fsListing = JSON.stringify(rdSync(process.cwd(), {}, '/'));
if (process.argv.length === 3) {
  const fname = process.argv[2];
  let parent = path.dirname(fname);
  while (!fs.existsSync(parent)) {
    fs.mkdirSync(parent);
    parent = path.dirname(parent);
  }
  fs.writeFileSync(fname, fsListing, { encoding: 'utf8' });
} else {
  console.debug(fsListing);
}
