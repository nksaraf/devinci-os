import type { Process } from '$lib/denix/denix';
import type { Remote } from '../comlink/mod';
import { fromWireValue, toWireValue } from '../comlink/http.handlers';
import { ProcessManager } from './proc_manager';

declare global {
  interface Navigator {
    process: Process;
  }
}

function syncOpCall(op_code: string, args) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/~proc/' + op_code, false);
  xhr.send(JSON.stringify([op_code, args.map(toWireValue)]));
  // look ma, i'm synchronous (•‿•)
  console.log('json response', xhr.responseText);
  let result = JSON.parse(xhr.responseText.length > 0 ? xhr.responseText : 'null') ?? [null, null];
  console.log(result);

  if (result[0]) {
    throw result[0];
  }

  if (!result[1]) {
    // throw new Error('No result');
    return undefined;
  }

  const value = fromWireValue(result[1][0]);
  return value;
}

export class RemoteProcessManager extends ProcessManager {
  proxy: Remote<ProcessManager>;
  spawnSync() {
    console.log('hereee');
    return syncOpCall('spawnSync', [...arguments]);
  }
}
