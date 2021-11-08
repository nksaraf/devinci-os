import './polyfill';
import toExport from '../global';
import { getInternalBinding } from './getInternalBinding';
import { createFileSystem, createFileSystemBackend } from '../fs';
import HttpRequest from '../fs/backend/HTTPRequest';

function bootstrapNode() {
  require('internal/per_context/primordials');
  let loaders = require('internal/bootstrap/loaders', {
    scope: {
      getInternalBinding,
    },
  });
  toExport.internalBinding = loaders.internalBinding;
  require('internal/bootstrap/node');
}

export async function loadNodeFS() {
  let httpFS = await createFileSystemBackend(HttpRequest, {
    index: '/node/index.json',
    baseUrl: '/node/',
  });

  let fs = await createFileSystem({
    '/@node': httpFS,
  });

  toExport.fs.initialize(fs);

  bootstrapNode();
  console.log(require('buffer'));
  require('fs');
  require('path');
}
