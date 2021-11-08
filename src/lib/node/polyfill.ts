import toExport from '../global';
import * as buffer from 'buffer';
import setImmediate from '../fs/generic/setImmediate';
import process from 'os/lib/node/process';
import { createRequire } from './require';
import nodeFS from './fs';

export function install(obj: any) {
  obj.Buffer = buffer.Buffer;
  obj.process = process;
  obj.setImmediate = setImmediate;
  obj.primordials = {};
  obj.require = createRequire({
    fs: nodeFS,
    args: [],
    argv: [],
    cwd: '/home',
    env: {},
  });
  obj.fs = nodeFS;
}

install(toExport);
