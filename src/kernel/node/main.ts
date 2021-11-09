import './polyfill';
import { createFileSystem, createFileSystemBackend } from '../fs';
import HttpRequest from '../fs/backend/HTTPRequest';
import { NodeHost } from './runtime';
import { Kernel } from '../kernel';

// function bootstrapNode({ fs: FileSystem }): Node {
//   const require = createNodeRequire({ fs: toExport.fs });
//   require('internal/per_context/primordials');
//   // @ts-ignore
//   let loaders = require('internal/bootstrap/loaders', {
//     scope: {
//       getInternalBinding,
//     },
//   });
//   toExport.internalBinding = loaders.internalBinding;

// }

export async function main() {
  await Kernel.boot();
  let httpFS = await createFileSystemBackend(HttpRequest, {
    index: '/node/index.json',
    baseUrl: '/node/',
    preferXHR: true,
  });

  Kernel.fs.mount('/@node', httpFS);
  NodeHost.bootstrap(Kernel);
}
