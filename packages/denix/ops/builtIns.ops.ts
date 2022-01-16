import { op_async, op_sync, Resource } from '../types.ts';
import type { Process } from '../kernel.ts';
import { FileResource } from './fs.ops.ts';

export const builtIns = [
  op_sync('op_close', function (this: Process, rid) {
    console.debug('closing', rid);
    this.closeResource(rid);
  }),
  op_sync('op_try_close', function (this: Process, rid) {
    console.debug('try closing', rid);
    try {
      this.closeResource(rid);
    } catch (e) {
      console.debug('couldnt close', rid);
    }
  }),
  op_sync('op_exit', function (this: Process, code) {
    this.exit(code);
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
      console.debug('reading', resource);
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
  op_sync('op_request_permission', function (this: Process, rid: number, desc: number) {
    // TODO: implement proper permissions
    return 'granted';
  }),
  op_sync('op_query_permission', function (this: Process, rid: number, desc: number) {
    // TODO: implement proper permissions
    return 'granted';
  }),
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
      console.debug(args);
      let { cwd, cmd, stdin, stdout, stderr, stdinRid, stdoutRid, stderrRid } = args;

      [stdin, stdinRid] = getStdio(this, stdin, stdinRid);
      [stdout, stdoutRid] = getStdio(this, stdout, stdoutRid);
      [stderr, stderrRid] = getStdio(this, stderr, stderrRid);

      console.debug('running', cmd, stdin, stdout, stderr);
      const pid = this.processManager.spawnSync({
        cmd,
        cwd: cwd ?? this.cwd,
        parentPid: this.pid,
        env: this.env,
        tty: stdin,
        stdin,
        stdout,
        stderr,
      });

      let rid = this.addResource(new ChildProcessResource(pid));

      return {
        rid,
        pid,
        stdinRid,
        stdoutRid,
        stderrRid,
      };
    },
  ),
  op_async('op_run_status', async function (this: Process, rid: number) {
    const resource = this.getResource(rid) as ChildProcessResource;
    return await this.processManager.waitFor(resource.pid);
  }),
];

class ChildWorkerResource extends Resource {
  constructor(public promise) {
    super();
  }

  close() {}
}

class ChildProcessResource extends Resource {
  type = 'child_process';

  constructor(public pid: number) {
    super();
  }

  close() {}
}

function getStdio(proc: Process, stdin: any, stdinRid: any) {
  if (stdin === 'piped') {
    let path = `/pipe/proc${proc.pid}`;
    stdinRid = proc.addResource(new FileResource(proc.fs.openSync(path, 0, 0x666)));
    stdin = path;
  } else if (stdin === 'inherit') {
    stdin = (proc.getResource(proc.stdin) as FileResource).file.getPath();
  } else if (stdin === 'null') {
    stdin = '/dev/null';
  } else if (stdinRid) {
    stdin = (proc.getResource(stdinRid) as FileResource).file.getPath();
  }
  console.debug('stdin', stdin, stdinRid);
  return [stdin, stdinRid];
}
