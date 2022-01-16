import type { Process } from './kernel.ts';
import type { Remote } from './lib/comlink/mod.ts';
import { fromWireValue, toWireValue } from './lib/comlink/http.handlers.ts';
import { ProcessManager } from './proc_manager.ts';

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
  console.debug('json response', xhr.responseText);
  let result = JSON.parse(xhr.responseText.length > 0 ? xhr.responseText : 'null') ?? [null, null];
  console.debug(result);

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
    console.debug('hereee', arguments);
    return syncOpCall('spawnSync', [...arguments]);
  }

  async waitFor(pid: number): Promise<{ statusCode: number; gotSignal: boolean }> {
    return await this.proxy.waitFor(pid);
  }
}
