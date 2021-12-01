import { mountDenoLib } from '$lib/denix/runtime';
import { expose } from '$lib/comlink/mod';

import { SharedFileSystem } from '$lib/fs/shared';

const fs = new SharedFileSystem();

mountDenoLib(fs).then(() => fs.readyPromise.resolve({}));

expose(fs);
