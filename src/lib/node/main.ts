import './polyfill';
import * as fs from '../fs';
import toExport from '../global';
import { getInternalBinding } from './getInternalBinding';

function loadNodeFS() {
  fs.promise.then((fs) => {
    console.log(require);
    require('internal/per_context/primordials');
    let loaders = require('internal/bootstrap/loaders', {
      scope: {
        getInternalBinding,
      },
    });

    console.log(loaders);
    toExport.internalBinding = loaders.internalBinding;

    console.log(require('buffer'));
    require('fs');
  });
}

loadNodeFS();
