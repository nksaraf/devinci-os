import type { Kernel } from './kernel';
import type { File } from '../fs/core/file';
import { SynchronousFileSystem } from '../fs/core/file_system';
import type { IFileSystem } from '../fs/core/file_system';
import Global from 'os/kernel/global';
export enum ProcessState {
  Starting,
  Running,
  Interruptable,
  Zombie,
}
// import { checkFlag } from './checkFlag';
// import { KernelFlags } from './types';
// import { wrap } from 'comlink';
import { PTYSlaveFile, TTY, TTYDevice } from './tty';
import type VirtualFile from '../fs/generic/virtual_file';

export interface Environment {
  [name: string]: string;
}

interface ProcessOptions {
  parent: Process;
  cwd: string;
  name: string;
  args: string[];
  env: Environment;
  worker?: Worker;
  kernel: Kernel;
  pid: number;
  files: { [key: number]: File };
}

export class Process {
  cwd: string;
  kernel: Kernel;
  env: { [key: string]: string };
  args: string[];
  tty: TTY;

  get stdin() {
    return this.files[0];
  }
  get stdout() {
    return this.files[1];
  }
  get stderr() {
    return this.files[2];
  }

  pid: number;
  parent: number;
  state: ProcessState = ProcessState.Starting;

  chdir(path: string): void {
    this.cwd = path;
  }

  private nextFd = 3;

  files: { [key: number]: VirtualFile } = {};

  constructor(args: string[]) {
    this.kernel = kernel;
    this.args = args;
    this.cwd = '/';
    this.env = {};
    this.pid = this.kernel.proc.getNextPid();
    this.parent = null;
    // this.exec('/bin/sh', ['sh']);
  }

  addFile(file: VirtualFile, fd: number = this.nextFd++): number {
    this.files[fd] = file;
    return fd;
  }

  exec(command: string, args: string[]): void {
    console.log(`exec: ${command} ${args.join(' ')}`);
  }

  async run() {
    if (this.state === ProcessState.Starting) {
      this.state = ProcessState.Running;
    }
  }
}

// class WorkerProcess extends Process {
//   worker: Worker;

//   constructor() {
//     this.worker = options.worker;
//   }

//   async run() {
//     if (this.worker) {
//       let cmd = this.args[0];
//       return await wrap<{ main: () => Promise<void> }>(this.worker)[cmd]();
//     }
//   }
// }

/**
 * Manages the OS processes.
 *
 * In Main Thread:
 *  * Processes are created and managed by the kernel.
 *  * as processes are executed, they are run on workers
 */
export class WorkerManager extends SynchronousFileSystem implements IFileSystem {
  getWorker(pid: number): Process {
    return this.workers[pid];
  }
  workers: { [key: number]: Process } = {};
  kernel: Kernel;
  constructor(kernel: Kernel) {
    super();
    this.kernel = kernel;
  }

  getName(): string {
    throw new Error('Method not implemented.');
  }
  isReadOnly(): boolean {
    throw new Error('Method not implemented.');
  }
  supportsProps(): boolean {
    throw new Error('Method not implemented.');
  }
  supportsSynch(): boolean {
    throw new Error('Method not implemented.');
  }

  readdirSync(p: string): string[] {
    throw new Error('Method not implemented.');
  }

  nextPid: number = -1;

  getNextPid() {
    return ++this.nextPid;
  }

  async init(): Promise<Process> {
    let initProcess = new Process(['init']);
    let device = new TTYDevice();
    device.on('output', console.log);

    Global.sendData = (data) => {
      debugger;
      for (var i = 0; i < data.length; i++) {
        device.emit('data', data[i]);
      }
      device.emit('data', '\n');
    };

    initProcess.tty = new TTY(device);
    initProcess.tty.startReading();
    let file = new PTYSlaveFile(initProcess.tty);
    initProcess.addFile(file, 0);
    initProcess.addFile(file, 1);
    initProcess.addFile(file, 2);
    return initProcess;
    // if (checkFlag(this.kernel.mode, KernelFlags.WORKER)) {
    //   return await this.spawn({
    //     parent: null,
    //     cwd: '/',
    //     name: 'init',
    //     args: [],
    //     env: {},
    //   });
    // } else {
    //   return await this.spawn({
    //     parent: null,
    //     cwd: '/',
    //     name: 'init',
    //     args: [],
    //     env: {},
    //   });
    // }
  }

  // async addWorker(options: Partial<ProcessOptions>) {
  //   options.worker.addEventListener('message', console.log);
  //   let proc = new WorkerProcess({
  //     args: [],
  //     env: {},
  //     files: {},
  //     ...options,
  //     parent: this.kernel.process,
  //     kernel: this.kernel,
  //     pid: this.getNextPid(),
  //     cwd: '/',
  //     name: 'worker',
  //   });
  //   this.workers[proc.pid] = proc;
  //   return proc;
  // }

  // async spawn({
  //   files,
  //   env = {},
  //   parent,
  //   name,
  //   args,
  //   cwd = '/',
  //   ...props
  // }: {
  //   parent: Process;
  //   cwd: string;
  //   name: string;
  //   args: string[];
  //   env: Environment;
  //   files?: { [key: number]: File };
  // }): Promise<Process> {
  //   let pid = this.getNextPid();

  //   // sparse map of files
  //   // if a task is a child of another task and has been
  //   // created by a call to spawn(2), inherit the parent's
  //   // file descriptors.
  //   if (files && parent) {
  //     files = {
  //       ...parent.files,
  //       ...files,
  //     };
  //     // }
  //   } else if (!files || !parent) {
  //     // if no files or no parent (init process)
  //     files = {};
  //     // files[0] = new PipeFile();
  //     // files[1] = new PipeFile();
  //     // files[2] = new PipeFile();
  //   }

  //   let proc = new Process([]);

  //   this.workers[pid] = proc;

  //   await proc.run();

  //   return proc;
  // }
}

// function parseEnvVar(s: string): [string, string] {
//   let eq = s.indexOf('=');
//   if (eq === -1) {
//     return [s, ''];
//   }
//   return [s.slice(0, eq), s.slice(eq + 1)];
// }
