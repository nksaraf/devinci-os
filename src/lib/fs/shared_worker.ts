import { mountDenoLib } from 'os/lib/deno/runtime';
import { expose } from '$lib/comlink/mod';

import { SharedFileSystem } from '$lib/fs/shared';
import Global from '../global';

const fs = new SharedFileSystem();

Global.fs = fs;

mountDenoLib(fs).then(() => fs.readyPromise.resolve({}));

expose(fs);
