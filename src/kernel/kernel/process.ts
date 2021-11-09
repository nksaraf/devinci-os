import type { Kernel } from './kernel';

export enum ProcessState {
  Starting,
  Running,
  Interruptable,
  Zombie,
}

export interface Environment {
  [name: string]: string;
}

interface ProcessOptions {
  parent: Process;
  cwd: string;
  name: string;
  args: string[];
  env: Environment;
  kernel: Kernel;
  pid: number;
  files: { [key: number]: File };
}

export class Process {
  cwd: string;
  kernel: Kernel;
  env: { [key: string]: string };
  args: string[];
  stdin: File;
  stdout: File;
  stderr: File;
  pid: number;
  chdir(path: string): void {
    this.cwd = path;
  }
  files: { [key: number]: File };
  constructor(options: ProcessOptions) {
    this.cwd = options.cwd;
    this.kernel = options.kernel;
    this.env = options.env;
    this.args = options.args;
    this.stdin = options.files[0];
    this.stdout = options.files[1];
    this.stderr = options.files[2];
    this.pid = options.pid;
    this.files = options.files;

    // this.files[0] = this.kernel.fs.openFileSync('/dev/stdin', 'r');
    // this.files[1] = new TTYFile();
    // this.files[2] = new TTYFile();
  }
}

export class ProcessManager {
  processes: { [key: number]: Process } = {};
  kernel: Kernel;
  constructor(kernel: Kernel) {
    this.kernel = kernel;
  }

  nextPid: 0;

  getNextPid() {
    return this.nextPid++;
  }

  init() {}

  spawn({
    filesArray,
    envArray = [],
    parent,
    ...props
  }: {
    parent: Process;
    cwd: string;
    name: string;
    args: string[];
    envArray: string[];
    filesArray: number[];
    cb: (err: number, pid: number) => void;
  }): void {
    let pid = this.getNextPid();

    let env: Environment = {};
    for (let i = 0; i < envArray.length; i++) {
      let s = envArray[i];
      let eq = s.search('=');
      if (eq < 0) continue;
      let k = s.substring(0, eq);
      let v = s.substring(eq + 1);
      env[k] = v;
    }

    // sparse map of files
    let files: { [n: number]: File } = [];
    // if a task is a child of another task and has been
    // created by a call to spawn(2), inherit the parent's
    // file descriptors.
    if (filesArray && parent) {
      for (let i = 0; i < filesArray.length; i++) {
        let fd = filesArray[i];
        if (!(fd in parent.files)) {
          console.log('spawn: tried to use bad fd ' + fd);
          break;
        }
        files[i] = parent.files[fd];
        // TODO: ADD REF COUNTING
        // files[i].ref();
      }
    } else {
      // files[0] = new NullFile();
      // files[1] = new PipeFile();
      // files[2] = new PipeFile();
    }

    let proc = new Process({
      parent,
      pid,
      cwd: '/',
      name: props.name,
      args: props.args,
      env,
      files,
      kernel: this.kernel,
    });

    this.processes[pid] = proc;
  }
}
