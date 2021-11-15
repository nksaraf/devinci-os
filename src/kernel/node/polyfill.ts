import Global from '../global';
// import * as buffer from 'buffer';
// import setImmediate from '../fs/generic/setImmediate';
import process from 'os/kernel/node/process';

export function install(obj: any) {
  // obj.Buffer = buffer.Buffer;
  obj.process = process;
  // obj.setImmediate = setImmediate;
}

install(Global);
