import { FileFlag } from '../fs/core/file_flag';
import type { FileSystem } from '../fs/core/file_system';
import * as buffer from 'buffer';
import type { FSModule } from './fs/fs';
import type NodeFileSystem from './fs/fs';
import { constants } from './constants';
import toExport from '../global';
function unique(arr) {
  return arr.filter((v, i) => {
    return arr.indexOf(v) === i;
  });
}

// export default class NodeProcess extends Process {
//   constructor(opts_) {
//     const { FS, ...opts } = opts_;
//     // This is not an Emscripten based process.
//     // Create a simple Emscripten base process to use its FS.
//     const fs = new FileSystem({ FS });
//     super({ ...opts, FS: fs.then((p) => p.FS) });
//   }

//   async exec(args, opts = {}) {
//     if (typeof args === 'string') args = args.split(/ +/g);

//     const stdout = [];
//     const stderr = [];

//     const print = (...args) => {
//       this.onprint(...args);
//       opts.print && opts.print(...args);
//       stdout.push(...args);
//     };
//     const printErr = (...args) => {
//       this.onprintErr(...args);
//       opts.printErr && opts.printErr(...args);
//       stderr.push(...args);
//     };

//     // The following code is VERY VERY hacky, I'm sorry.

//     // Create a require type function. We read the input file and then kind of `eval` it using `Function`.
//   }
// }

type RequireFn = typeof globalThis.require;
type Module = ReturnType<RequireFn>;

export function createRequire({
  fs,
  args,
  argv,
  cwd = '/',
  log = (msg, level) => console.log(level, msg),
  onError = (err) => {
    throw err;
  },
}: {
  fs: NodeFileSystem;
  cwd?: string;
  args?: string[];
  argv?;
  log?: (msg: string, level: string) => void;
  onError?: (err: Error) => void;
  env?: Record<string, any>;
}): RequireFn {
  function require(file: string, { scope = {} } = {}): any {
    const __filename = require.resolve(file);
    console.log('requiring', __filename, scope);
    // const __dirname = __filename.split('/').slice(0, -1).join('/');

    if (require.cache.has(__filename || file)) return require.cache.get(__filename || file);

    if (!__filename) throw new Error(`File not found ${JSON.stringify(file)}`);

    const module = { exports: {} };
    const exports = module.exports;

    // Create a Proxy for a global object. Combined with using "with" we can capture all accesses that would otherwise go to globalThis.
    const global = new Proxy(
      {},
      {
        has: () => true,
        get: (o, k) => (k in o ? o[k] : globalThis[k]),
        set: (o, k, v) => {
          o[k] = v;
          return true;
        },
      },
    );

    try {
      console.log(scope);
      const result = scopeEval(require.read(__filename), {
        require,
        module,
        exports,
        global,
        primordials: primordials,
        // globalThis: global,
        ...scope,
        ...(scope.getInternalBinding
          ? {}
          : {
              internalBinding: toExport.internalBinding,
            }),
      });

      if (result) {
        require.cache.set(__filename, result);
        return result;
      }
    } catch (err) {
      throw err;
    }

    //

    // if (module.exports == exports && Object.keys(exports).length == 0) {
    //   module.exports = result;
    // }

    require.cache.set(__filename, module.exports);
    return require.cache.get(__filename);
  }

  require.read = (file) => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.startsWith('#!')) {
      return `//${content}`;
    }
    return `// ${file}
    ${content}`;
  };

  require.withScope = (file) => {};

  require.search_path = [];
  require.resolve = (file) => {
    // const analyze = (p, dir = cwd) => {
    //   if (!p.startsWith('/')) p = `${dir}/${p}`;
    //   try {
    //     let res = fs.statSync(p);
    //     return {
    //       stats: res,
    //       exists: true,
    //     };
    //   } catch (e) {
    //     return {
    //       exists: false,
    //     };
    //   }
    // };
    // const test = (p, dir = cwd) => {
    //   const res = analyze(p, dir);
    //   if (res.exists && res.object.isFolder) {
    //     if (analyze('package.json', res.path).exists) {
    //       const pkg = JSON.parse(require.read(`${res.path}/package.json`));
    //       if (pkg.main) {
    //         return test_with_ext(pkg.main || 'index.js', res.path);
    //       }
    //     } else if (analyze('index.js', res.path).exists) {
    //       return test('index.js', res.path);
    //     }
    //   }
    //   return res.exists && !res.object.isFolder && res.path;
    // };
    // const test_with_ext = (p, dir = cwd) => {
    //   return test(p, dir) || test(`${p}.js`, dir);
    // };
    // const test_with_node_modules = (p, dir = cwd) => {
    //   return test_with_ext(p, dir) || test_with_ext(p, `${dir}/node_modules`);
    // };
    // const test_recursive = (p, dir = cwd) => {
    //   let res = test_with_node_modules(p, dir);
    //   while (!res && dir !== '/') {
    //     dir = analyze(dir).parentPath;
    //     res = test_with_node_modules(p, dir);
    //   }
    //   return res;
    // };
    // for (let dir of [...require.search_path, cwd, '/node']) {
    //   const result = test_recursive(file, dir);
    //   if (result) return result;
    // }
    return `@node/${file}.js`;
    // return '';
  };

  require.cache = new Map<String, NodeModule>();

  require.cache.set('@node/buffer.js', buffer);

  return require as unknown as NodeRequire;
  // require.cache.set('process', {
  //   cwd() {
  //     return cwd;
  //   },
  //   argv: args.slice(0),
  //   stdout: {
  //     write: print,
  //     on: function () {
  //       return this;
  //     },
  //     once: function () {
  //       return this;
  //     },
  //   },
  //   stderr: {
  //     write: onError,
  //     on: () => {},
  //     once: () => {},
  //   },
  //   env: opts.env ? (opts.env instanceof Map ? Object.fromEntries([...opts.env]) : opts.env) : {},
  //   on: function () {
  //     return this;
  //   },
  //   once: function () {
  //     return this;
  //   },
  //   exit() {},
  //   versions: {
  //     node: '14.15.5',
  //   },
  // });
  // require.cache.set('console', {
  //   log: (...args) => {
  //     log(args.join(' ') + '\n', 'info');
  //   },
  //   warn: (...args) => {
  //     log(args.join(' ') + '\n', 'warn');
  //   },
  //   error: (...args) => {
  //     log(args.join(' ') + '\n', 'error');
  //   },
  // });
  // require.cache.set('fs', {
  //   existsSync: (path) => {
  //     return fs.analyzePath(path).exists;
  //   },
  //   readFileSync: (path) => {
  //     return fs.readFile(path, { encoding: 'utf8' });
  //   },
  //   createWriteStream: (path, opts = {}) => {
  //     if (
  //       !(('string' === typeof opts && opts !== 'w') || (opts && opts.flags && opts.flags !== 'w'))
  //     ) {
  //       fs.writeFile(path, '');
  //     }
  //     return {
  //       write: (str) => {
  //         fs.writeFile(path, fs.readFile(path, { encoding: 'utf8' }) + str);
  //       },
  //       on: function () {
  //         return this;
  //       },
  //       once: function () {
  //         return this;
  //       },
  //     };
  //   },
  // });
  // require.cache.set('os', {
  //   EOL: '\n',
  // });
  // require.cache.set('child_process', {
  //   spawn: () => {
  //     throw new Error('Not implemented');
  //   },
  // });
  // require.cache.set('http', {});
  // require.cache.set('https', {});
  // require.cache.set('url', {});

  // if (args[1] === '--version') {
  //   return this.exec(['node', '-e', 'console.log(`v${process.versions.node}`)']);
  // } else if (args[1] === '-e') {
  //   fs.writeFile(
  //     '/tmp/node_tmp.js',
  //     `process.argv = [process.argv[0], ...process.argv.slice(2)]; ${args[2]}`,
  //   );
  //   return this.exec([args[0], '/tmp/node_tmp.js', ...args.slice(3)]);
  // } else {
  //   let curr_cwd = this.cwd;
  //   if (opts.cwd) this.cwd = opts.cwd;
  //   let returncode = 0;
  //   try {
  //     require(args[1]);

  //     // wait for a new task to give micro-tasks time to resolve
  //     await new Promise((r) => setTimeout(r, 100));
  //   } catch (err) {
  //     returncode = 1;
  //     require('console').error(err.stack);
  //   } finally {
  //     this.cwd = curr_cwd;
  //   }
  //   return {
  //     returncode,
  //     stdout: stdout.join(''),
  //     stderr: stderr.join(''),
  //   };
  // }
}

let hasProp = {}.hasOwnProperty;
let slice = [].slice;

function scopeEval(source, scope) {
  var key, keys, value, values;
  keys = [];
  values = [];
  for (key in scope) {
    if (!hasProp.call(scope, key)) continue;
    value = scope[key];
    if (key === 'this') {
      continue;
    }
    keys.push(key);
    values.push(value);
  }

  return Function.apply(null, slice.call(keys).concat(source)).apply(scope['this'], values);
}
