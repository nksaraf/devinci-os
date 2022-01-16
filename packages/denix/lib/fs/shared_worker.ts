import { mountDenoLib } from '../deno/runtime.ts';
import { expose } from '$lib/comlink/mod.ts';

import { SharedFileSystem } from '$lib/fs/shared.ts';
import Global from '../global.ts';

const fs = new SharedFileSystem();

Global.fs = fs;

mountDenoLib(fs).then(() => fs.readyPromise.resolve({}));

expose(fs);
