import { op_async, op_sync, Resource } from '../types';
import type { DenixProcess } from '../denix';
import { DenixWorker } from '$lib/deno/worker';

export const builtIns = [
  op_sync('op_close', function (this: DenixProcess, rid) {
    console.log('closing', rid);
    if (!this.resourceTable.has(rid)) {
      return;
    }
    let resource = this.getResource(rid);
    resource.close();
    this.resourceTable.delete(rid);
  }),
  op_sync('op_try_close', function (this: DenixProcess, rid) {
    console.log('try closing', rid);
    let resource = this.getResource(rid);
    try {
      resource.close();
      this.resourceTable.delete(rid);
    } catch (e) {
      console.log('couldnt close', rid, resource);
    }
  }),
  op_sync('op_print', function (this: DenixProcess, msg: string, is_err: boolean) {
    console.log(msg);
  }),
  {
    name: 'op_read',
    sync: () => {},
    async: async function (this: DenixProcess, rid: number, data: Uint8Array) {
      let resource = this.getResource(rid);
      return await resource.read(data);
    },
  },
  {
    name: 'op_write',
    sync: () => {},
    async: async function (this: DenixProcess, rid: number, data: Uint8Array) {
      let resource = this.getResource(rid);
      return await resource.write(data);
    },
  },
  op_async('op_shutdown', async function (this: DenixProcess, rid: number) {
    let resource = this.getResource(rid);
    return await resource.shutdown();
  }),
  op_sync('op_get_env', function (this: DenixProcess, key: string) {
    return this.env[key] ?? '';
  }),
  op_sync('op_set_env', function (this: DenixProcess, key: string, val: string) {
    this.env[key] = val;
  }),
  op_sync('op_signal_bind', function (this: DenixProcess, signal: string, val: string) {
    // this.env[key] = val;
    this.addEventListener('signal', (e) => {});
  }),
  op_sync(
    'op_run',
    function (
      this: DenixProcess,
      args: { cwd; cmd; stdin; stdout; stderr; stdinRid; stdoutRid; stderrRid },
    ) {
      let { cwd, cmd, stdin, stdout, stderr } = args;

      const process = new DenixWorker(this);

      if (stdin === 'inherit') {
        process.addResource();
      }

      process.isolate.run(cmd[2]);

      let rid = this.addResource(new ChildProcessResource());
      return {
        rid,
      };
    },
  ),
];

let PROCESS_ID = 0;
class Process extends EventTarget {
  pid: number;
  resourceTable: Map<number, Resource> = new Map();
  constructor({ cmd, cwd, env, stdin, stdout, stderr, permissions }) {
    super();
    this.pid = PROCESS_ID++;
  }
}

class ChildProcessResource extends Resource {
  pid: number;
}
