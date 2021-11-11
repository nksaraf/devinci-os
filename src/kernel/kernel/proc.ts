import type { Kernel } from './kernel';
import { PipeFile } from './pipe';
import type { File } from '../fs/core/file';
import { BaseFileSystem, SynchronousFileSystem } from '../fs/core/file_system';
import type { IFileSystem } from '../fs/core/file_system';
export enum ProcessState {
  Starting,
  Running,
  Interruptable,
  Zombie,
}
import Global from '../global';
import type TTYFile from './tty';
import { checkFlag } from './checkFlag';
import { KernelFlags } from './types';
import { wrap } from 'comlink';
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
  tty: TTYFile;
  stdin: VirtualFile;
  stdout: VirtualFile;
  stderr: VirtualFile;
  pid: number;
  state: ProcessState = ProcessState.Starting;

  chdir(path: string): void {
    this.cwd = path;
  }

  private nextFd = 3;

  files: { [key: number]: File } = {};

  constructor(options: ProcessOptions) {
    this.cwd = options.cwd ?? '/';
    this.kernel = options.kernel;
    this.worker = options.worker;
    this.env = options.env;
    this.args = options.args;
    // this.stdin = options.files[0];
    // this.stdout = options.files[1];
    // this.stderr = options.files[2];
    this.pid = options.pid;
    // this.files = options.files;

    this.exec('/bin/sh', ['sh']);

    // this.files[0] = this.kernel.fs.openFileSync('/dev/stdin', 'r');
    // this.files[1] = new TTYFile();
    // this.files[2] = new TTYFile();
  }

  getNextFD() {
    return this.nextFd++;
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

class WorkerProcess extends Process {
  worker: Worker;

  constructor(options: ProcessOptions) {
    super(options);
    this.worker = options.worker;
  }

  async run() {
    if (this.worker) {
      let cmd = this.args[0];
      return await wrap<{ main: () => Promise<void> }>(this.worker)[cmd]();
    }
  }
}

/**
 * Manages the OS processes.
 *
 * In Main Thread:
 *  * Processes are created and managed by the kernel.
 *  * as processes are executed, they are run on workers
 */
export class ProcessManager extends SynchronousFileSystem implements IFileSystem {
  getProcess(pid: number): Process {
    return this.processes[pid];
  }
  processes: { [key: number]: Process } = {};
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
    if (checkFlag(this.kernel.mode, KernelFlags.WORKER)) {
      return await this.spawn({
        parent: null,
        cwd: '/',
        name: 'init',
        args: [],
        env: {},
      });
    } else {
      return await this.spawn({
        parent: null,
        cwd: '/',
        name: 'init',
        args: [],
        env: {},
      });
    }
  }

  async addWorker(options: Partial<ProcessOptions>) {
    options.worker.addEventListener('message', console.log);
    let proc = new WorkerProcess({
      args: [],
      env: {},
      files: {},
      ...options,
      parent: this.kernel.process,
      kernel: this.kernel,
      pid: this.getNextPid(),
      cwd: '/',
      name: 'worker',
    });
    this.processes[proc.pid] = proc;
    return proc;
  }

  async spawn({
    files,
    env = {},
    parent,
    name,
    args,
    cwd = '/',
    ...props
  }: {
    parent: Process;
    cwd: string;
    name: string;
    args: string[];
    env: Environment;
    files?: { [key: number]: File };
  }): Promise<Process> {
    let pid = this.getNextPid();

    // sparse map of files
    // if a task is a child of another task and has been
    // created by a call to spawn(2), inherit the parent's
    // file descriptors.
    if (files && parent) {
      files = {
        ...parent.files,
        ...files,
      };
      // }
    } else if (!files || !parent) {
      // if no files or no parent (init process)
      files = {};
      // files[0] = new PipeFile();
      // files[1] = new PipeFile();
      // files[2] = new PipeFile();
    }

    let proc = new Process({
      parent,
      pid,
      cwd,
      name,
      args,
      env,
      files,
      kernel: this.kernel,
    });

    this.processes[pid] = proc;

    await proc.run();

    return proc;
  }

  listProcesses(): Process[] {
    
  }
}

function parseEnvVar(s: string): [string, string] {
  let eq = s.indexOf('=');
  if (eq === -1) {
    return [s, ''];
  }
  return [s.slice(0, eq), s.slice(eq + 1)];
}
