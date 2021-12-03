import { op_async, op_sync, Resource } from '../types';
import type { Process } from '../denix';
import type { FileResource } from './fs.ops';

export const builtIns = [
  op_sync('op_close', function (this: Process, rid) {
    console.log('closing', rid);
    this.closeResource(rid);
  }),
  op_sync('op_try_close', function (this: Process, rid) {
    console.log('try closing', rid);
    try {
      this.closeResource(rid);
    } catch (e) {
      console.log('couldnt close', rid);
    }
  }),
  op_sync('op_print', function (this: Process, msg: string, is_err: boolean) {
    if (is_err) {
      (this.getResource(this.stderr) as FileResource).writeSync(new TextEncoder().encode(msg));
    } else {
      (this.getResource(this.stdout) as FileResource).writeSync(new TextEncoder().encode(msg));
    }
  }),
  {
    name: 'op_read',
    sync: () => {},
    async: async function (this: Process, rid: number, data: Uint8Array) {
      let resource = this.getResource(rid);
      console.log('reading', resource);
      return await resource.read(data);
    },
  },
  {
    name: 'op_write',
    sync: () => {},
    async: async function (this: Process, rid: number, data: Uint8Array) {
      let resource = this.getResource(rid);
      return await resource.write(data);
    },
  },
  op_async('op_shutdown', async function (this: Process, rid: number) {
    let resource = this.getResource(rid);
    return await resource.shutdown();
  }),
  op_sync('op_get_env', function (this: Process, key: string) {
    return this.env[key] ?? '';
  }),
  op_sync('op_set_env', function (this: Process, key: string, val: string) {
    this.env[key] = val;
  }),
  op_sync('op_signal_bind', function (this: Process, signal: string, val: string) {
    // this.env[key] = val;
    this.addEventListener('signal', (e) => {});
  }),
  op_sync(
    'op_run',
    function (
      this: Process,
      args: { cwd; cmd; stdin; stdout; stderr; stdinRid; stdoutRid; stderrRid },
    ) {
      let { cwd, cmd, stdin, stdout, stderr } = args;

      // const process = navigator.process.spawn({
      //   cmd,
      //   cwd,
      //   stdin,
      // });

      let rid = this.addResource(
        new ChildWorkerResource(
          navigator.isolate.run(`/bin/${cmd[0]}.ts`, {
            args: cmd,
            mode: 'module',
          }),
        ),
      );

      // if (stdin === 'inherit') {
      //   process.addResource();
      // }

      // process.isolate.run(cmd[2]);

      // let rid = this.addResource(new ChildProcessResource());
      return {
        rid,
      };
    },
  ),
  op_async('op_run_status', async function (this: Process, rid: number) {
    const resource = this.getResource(rid) as ChildWorkerResource;

    try {
      let result = await resource.promise;
      return {
        statusCode: result,
        gotSignal: false,
      };
    } catch (e) {
      await this.getResource(this.stderr).write(new TextEncoder().encode(e.message + '\r\n'));
      return {
        statusCode: -1,
        gotSignal: false,
      };
    }
  }),
];

class ChildWorkerResource extends Resource {
  constructor(public promise) {
    super();
  }

  close() {}
}

let PROCESS_ID = 0;
// class Process extends EventTarget {
//   pid: number;
//   resourceTable: Map<number, Resource> = new Map();
//   constructor({ cmd, cwd, env, stdin, stdout, stderr, permissions }) {
//     super();
//     this.pid = PROCESS_ID++;
//   }
// }

class ChildProcessResource extends Resource {
  type = 'child_process';
  pid: number;
}
