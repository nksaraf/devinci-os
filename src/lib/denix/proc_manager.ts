import { Process } from 'os/lib/denix/kernel';
import { proxy, wrap, expose } from '../comlink/mod';
import type { Remote } from '../comlink/mod';
import { createResourceTable } from './types';
import { mountDenoLib } from '../deno/runtime';
import { DeviceFileSystem } from './device_fs';
import type { RemoteProcessOptions } from './process.worker';
import { SharedFileSystem } from '../fs/shared';
import { createState } from '@state-designer/core';
import type { DesignedState } from '@state-designer/core/dist/types/types';
import { newPromise } from '../promise';
import { renderState } from './logger';
export let NEXT_PROCESS_ID = 1;

export class ProcessManager extends EventTarget {
  async waitFor(pid: number): Promise<{ statusCode: number; gotSignal: boolean }> {
    let process = this.processes.get(pid);
    if (!process) {
      throw new Error('process not found ' + pid);
    }

    const promise = newPromise<{ statusCode: number; gotSignal: boolean }>();

    process.onUpdate((data) => {
      if (data.isInAny('done', 'disposed')) {
        promise.resolve({
          statusCode: data.data.statusCode,
          gotSignal: data.data.gotSignal,
        });
      }
    });

    return await promise.promise;
  }

  fs: SharedFileSystem;
  constructor() {
    super();
  }

  processes = new Map<
    number,
    DesignedState<{
      workerPromise?: Promise<Remote<Process>>;
      processPromise?: any;
      statusCode?: any;
      gotSignal?: any;
      process?: Process;
      pid?: number;
    }>
  >();

  main: Process;

  async start() {
    this.fs = new SharedFileSystem();
    // const fsWorker = new Worker(new URL('./fs.worker.ts?worker_file', import.meta.url).href, {
    //   type: 'module',
    //   name: 'filesystem',
    // });
    // let fsRemote = new RemoteFileSystem(fsWorker, false);
    // globalFS.rootFs = fsRemote;
    await mountDenoLib(this.fs);
    // await fsRemote.proxy.ready();
    await this.fs.mount('/dev', new DeviceFileSystem());

    this.fs.readyPromise.resolve(true);

    const main = new Process();
    await main.init({
      pid: 0,
      fs: this.fs,
      proc: this,
      parentPid: undefined,
      cmd: ['bootup'],
      cwd: '/',
      env: {},
      stdin: '/dev/tty0',
      stdout: '/dev/tty0',
      stderr: '/dev/tty0',
      tty: '/dev/tty0',
    });

    const machine = createProcessMachine(0);
    machine.send('CREATED_PROCESS', main);

    this.processes.set(main.pid, machine);

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
    console.debug(`spawning ${cmd.join(' ')} (${pid})`, {
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

    const processMachine = createProcessMachine(pid);
    processMachine.onUpdate((data) => {
      console.debug(pid, cmd);
      console.debug(renderState(data, cmd.join(' ')));
    });
    this.processes.set(pid, processMachine);

    let workerPromise = this.spawnWorker({
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

    processMachine.send('SPAWNING_WORKER', workerPromise);

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
    console.debug(`spawning ${cmd.join(' ')} (${pid})`, {
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

    const machine = createProcessMachine(pid);
    machine.onUpdate((data) => {
      console.debug(pid, cmd);
      console.debug(renderState(data, cmd.join(' ')));
    });
    this.processes.set(pid, machine);

    await this.spawnWorker({
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

    return pid;
  }

  private async spawnWorker({
    cmd,
    pid,
    cwd,
    stdin,
    stdout,
    stderr,
    env,
    parentPid,
    tty,
  }: Partial<RemoteProcessOptions>) {
    let machine = this.processes.get(pid);
    const worker = new Worker(new URL('./process.worker.ts?worker-file', import.meta.url).href, {
      type: 'module',
      name: `${cmd.join(' ')} (${pid})`,
    });

    const comlink = wrap<{ addEventListener; spawn }>(worker);

    console.debug(machine);

    machine.send('SPAWNED_WORKER');

    const msgChannel = new MessageChannel();

    expose(this, msgChannel.port1);

    // let parent = await this.processes.get(parentPid);
    let resourceTable = createResourceTable();
    // we want to be able to get a new fs connection for each process
    let fs = await this.fs.newConnection();

    await comlink.addEventListener(
      'alive',
      proxy((e) => {
        machine.send('ALIVE');
      }),
    );

    await comlink.addEventListener(
      'exit',
      proxy((e) => {
        machine.send('EXIT', e.detail.code);
      }),
    );

    worker.onerror = (e) => {
      console.error('WORKER ERROR', e);
    };

    // terminate the worker if the process is done
    machine.onUpdate((data) => {
      if (data.isIn('done')) {
        // worker.terminate();
        data.send('DISPOSE', worker);
      }
    });

    await comlink.spawn(
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

    machine.send('CREATED_PROCESS_WORKER');
  }
}

// Worker
// Create worker
// Spawn process
//

function createProcessMachine(id) {
  return createState({
    id: id,
    data: {
      pid: id,
      workerPromise: null,
      processPromise: null,
      process: null,
      processProxy: null,
      worker: null,
      workerComlink: null,
      statusCode: undefined,
      gotSignal: false,
    },
    initial: 'loading',
    states: {
      loading: {
        on: {
          SPAWNING_WORKER: {
            do: (data, ev) => {
              data.workerPromise = ev;
            },
          },
          SPAWNED_WORKER: {
            do: (data, ev) => {
              // data.worker = ev.worker;
              // data.workerComlink = ev.comlink;
            },
          },
          LOADED: [{ to: 'running' }],
          CREATED_PROCESS: {
            to: 'running',
            do: (data, ev) => {
              // data.process = ev;
            },
          },
          CREATED_PROCESS_WORKER: {
            to: 'running',
            do: (data, ev) => {
              // data.process = ev;
            },
          },
          EXIT: {
            to: 'done',
            do: 'setStatusCode',
          },
          DISPOSE: {
            to: 'disposed',
          },
        },
      },
      running: {
        on: {
          DISPOSE: {
            to: 'disposed',
          },
          EXIT: {
            to: 'done',
            do: 'setStatusCode',
          },
        },
        initial: 'alive',
        states: {
          alive: {
            onEnter: {
              wait: 120,
              to: 'done',
            },
            on: {
              PING: {
                to: 'ping',
              },
            },
          },
          ping: {
            onEnter: {
              to: 'alive',
            },
          },
        },
      },
      done: {
        on: {
          DISPOSE: {
            to: 'disposed',
          },
        },
      },
      disposed: {
        onEnter: {
          do: 'terminateWorker',
        },
      },
    },
    actions: {
      setStatusCode: (data, statusCode) => {
        data.statusCode = statusCode;
      },
      terminateWorker: (data, worker) => {
        if (data.worker) {
          data.worker.terminate();
        }
      },
    },
  });
}
