import './polyfill';
import { createFileSystem, createFileSystemBackend } from '../fs';
import HttpRequest from '../fs/backend/HTTPRequest';
import { Node } from './runtime';

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

export async function loadNodeFS() {
  let httpFS = await createFileSystemBackend(HttpRequest, {
    index: '/node/index.json',
    baseUrl: '/node/',
  });

  let fs = await createFileSystem({
    '/@node': httpFS,
  });

  Node.bootstrap({ fs });
  const node = Node.require('fs');
  // bootstrapNode({ fs });

  // Node.require('buffer');
  // node.fs = require('fs');
  // node.path = require('path');

  // toExport.node = node;
}
