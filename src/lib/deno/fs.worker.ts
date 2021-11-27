import { mountDenoLib } from 'os/lib/denix/runtime';
import { expose } from 'os/lib/comlink';
import { SharedFileSystem } from 'os/lib/fs/shared';

const fs = new SharedFileSystem();

mountDenoLib(fs).then(() => fs.readyPromise.resolve({}));

expose(fs);
