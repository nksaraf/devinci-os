import { fs as globalFS } from '$lib/fs';
import { Process } from '$lib/denix/denix';
import { proxy, wrap, expose } from '../comlink/mod';
import type { Remote } from '../comlink/mod';
import { createResourceTable } from './types';
import { mountDenoLib } from '../deno/runtime';
import { DeviceFileSystem } from './device_fs';
import type { RemoteProcessOptions } from './process.worker';

export let NEXT_PROCESS_ID = 1;

export class ProcessManager extends EventTarget {
  constructor() {
    super();
  }

  processes = new Map<
    number,
    Process | Remote<Process> | Promise<Process> | Promise<Remote<Process>>
  >();
  main: Process;

  async start() {
    // const fsWorker = new Worker(new URL('./fs.worker.ts?worker_file', import.meta.url).href, {
    //   type: 'module',
    //   name: 'filesystem',
    // });
    // let fsRemote = new RemoteFileSystem(fsWorker, false);
    // globalFS.rootFs = fsRemote;
    await mountDenoLib(globalFS);
    // await fsRemote.proxy.ready();
    await globalFS.mount('/dev', new DeviceFileSystem());

    globalFS.readyPromise.resolve(true);

    const main = new Process();
    await main.init({
      pid: 0,
      fs: globalFS,
      proc: this,
      parentPid: undefined,
      cmd: ['bootup'],
      cwd: '/',
      env: {},
      tty: '/dev/tty0',
    });

    this.processes.set(main.pid, main);

    Reflect.defineProperty(navigator, 'process', {
      value: main,
    });
  }

  spawnSync({
    cmd,
    pid = NEXT_PROCESS_ID++,
    cwd,
    env,
    parentPid = 0,
    stdin,
    stdout,
    stderr,
    tty,
  }): number {
    console.log(`spawning ${cmd.join(' ')} (${pid}) `);
    const worker = this.spawnWorker({
      cmd,
      pid,
      cwd,
      env,
      parentPid,
      stdin,
      stdout,
      stderr,
      tty,
    });

    worker.then((p) => {
      console.log(p);
      this.processes.set(pid, p);
    });

    this.processes.set(pid, worker);

    return pid;
  }

  async spawn({
    cmd,
    pid = NEXT_PROCESS_ID++,
    cwd,
    env,
    parentPid = 0,
    stdin,
    stdout,
    stderr,
    tty,
  }): Promise<number> {
    console.log(`spawning ${cmd.join(' ')} (${pid})`);
    const worker = await this.spawnWorker({
      cmd,
      pid,
      cwd,
      env,
      stdin,
      stdout,
      stderr,
      parentPid,
      tty,
    });

    console.log(worker);

    this.processes.set(pid, worker);

    return pid;
  }

  async spawnWorker({
    cmd,
    pid = NEXT_PROCESS_ID++,
    cwd,
    stdin,
    stdout,
    stderr,
    env,
    parentPid,
    tty,
  }: Partial<RemoteProcessOptions>) {
    const processWorker = wrap<{
      spawn: (options: RemoteProcessOptions) => Promise<Remote<Process>>;
    }>(
      new Worker(new URL('./process.worker.ts?worker-file', import.meta.url).href, {
        type: 'module',
        name: `${cmd.join(' ')} (${pid})`,
      }),
    );

    const msgChannel = new MessageChannel();

    expose(this, msgChannel.port1);

    // let parent = await this.processes.get(parentPid);
    let resourceTable = createResourceTable();
    // we want to be able to get a new fs connection for each process
    let fs = await globalFS.newConnection();

    let process = await processWorker.spawn(
      proxy({
        parentPid: parentPid,
        pid: pid,
        fsPort: fs,
        procPort: msgChannel.port2,
        stdin,
        stdout,
        stderr,
        resourceTable,
        cmd: cmd,
        cwd,
        env,
        tty,
      }),
    );

    console.log(`spawned ${cmd.join(' ')} (${pid})`, process);

    return process;
  }
}
