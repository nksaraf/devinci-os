import type { Kernel } from 'os/kernel';
import { ProcessState } from './proc
export interface Environment {
  [name: string]: string;
}

export class Task {
  kernel: Kernel;
  worker: Worker;

  state: ProcessState;

  pid: number;

  // sparse map of files
  files: { [n: number]: File } = {};

  exitCode: number;

  exePath: string;
  exeFd: any;
  blobUrl: string;
  args: string[];
  env: Environment;

  pendingExePath: string;
  pendingArgs: string[];
  pendingEnv: Environment;

  cwd: string; // must be absolute path

  waitQueue: any[] = [];

  heapu8: Uint8Array;
  heap32: Int32Array;
  sheap: SharedArrayBuffer;
  waitOff: number;

  // used during fork, unset after that.
  heap: ArrayBuffer;
  forkArgs: any;

  parent: Task;
  children: Task[] = [];

  onExit: ExitCallback;

  priority: number;

  private msgIdSeq: number = 1;
  private onRunnable: (err: number, pid: number) => void;

  private syncSyscall: (n: number, args: number[]) => void;
  private syncSyscallStart: number = 0.0;

  private timeWorkerStart: number = 0.0;
  private timeFirstMsg: number = 0.0;
  private timeSyscallTotal: number = 0.0;

  constructor(
    kernel: Kernel,
    parent: Task,
    pid: number,
    cwd: string,
    filename: string,
    args: string[],
    env: Environment,
    files: { [n: number]: File },
    blobUrl: string,
    heap: ArrayBuffer,
    forkArgs: any,
    cb: (err: number, pid: number) => void,
  ) {
    //console.log('spawn PID ' + pid + ': ' + args.join(' '));

    this.state = ProcessState.Starting;
    this.pid = pid;
    this.parent = parent;
    this.kernel = kernel;
    this.exeFd = null;
    this.cwd = cwd;
    this.priority = 0;
    if (parent) {
      this.priority = parent.priority;
      this.parent.children.push(this);
    }

    this.files = files;

    this.blobUrl = blobUrl;
    this.heap = heap;
    this.forkArgs = forkArgs;

    // often, something needs to be done after this task
    // is ready to go.  Keep track of that callback here
    // -- this is overriden in exec().
    this.onRunnable = cb;

    // the JavaScript code of the worker that we're
    // launching comes from the filesystem - unless we are
    // forking and have a blob URL, we need to read-in that
    // file (potentially from an XMLHttpRequest) and
    // continue initialization when it is ready.

    if (blobUrl) {
      this.pendingExePath = filename;
      this.pendingArgs = args;
      this.pendingEnv = env;
      this.blobReady(blobUrl);
    } else {
      this.exec(filename, args, env, cb);
    }
  }

  personality(kind: number, sab: SharedArrayBuffer, off: number, cb: (err: number) => void): void {
    if (kind !== PER_BLOCKING) {
      cb(-EINVAL);
      return;
    }
    this.timeFirstMsg = performance.now();

    this.sheap = sab;
    this.heapu8 = new Uint8Array(sab);
    this.heap32 = new Int32Array(sab);
    this.waitOff = off;
    this.syncSyscall = syncSyscalls((<Kernel>this.kernel).syscallsCommon, this, (ret: number) => {
      this.timeSyscallTotal += performance.now() - this.syncSyscallStart;

      Atomics.store(this.heap32, (this.waitOff >> 2) + 1, ret);
      Atomics.store(this.heap32, this.waitOff >> 2, 1);
      Atomics.wake(this.heap32, this.waitOff >> 2, 1);
      // console.log('[' + this.pid + '] \t\tDONE \t' + ret);
    });

    cb(null);
  }

  exec(
    filename: string,
    args: string[],
    env: Environment,
    cb: (err: any, pid: number) => void,
  ): void {
    this.pendingExePath = filename;
    this.pendingArgs = args;
    this.pendingEnv = env;

    // console.log('EXEC: ' + filename + ' -- [' + (args.join(',')) + ']');

    // often, something needs to be done after this task
    // is ready to go.  Keep track of that callback here.
    this.onRunnable = cb;

    setImmediate(() => {
      this.kernel.fs.open(filename, 'r', this.fileOpened.bind(this));
    });
  }

  chdir(path: string, cb: Function): void {
    if (!path.length) {
      cb(-constants.ENOENT);
    }
    if (path[0] !== '/') path = resolve(this.cwd, path);
    // make sure we are chdir'ing into a (1) directory
    // that (2) exists
    this.kernel.fs.stat(path, (err: any, stats: any) => {
      if (err) {
        cb(-EACCES);
        return;
      }
      if (!stats.isDirectory()) {
        cb(-constants.ENOTDIR);
        return;
      }
      // TODO: should we canonicalize this?
      this.cwd = path;
      cb(0);
    });
  }

  allocFD(): number {
    let n = 0;
    for (n = 0; this.files[n]; n++) {}

    return n;
  }

  addFile(f: File): number {
    let n = this.allocFD();
    this.files[n] = f;
    return n;
  }

  fileOpened(err: any, fd: any): void {
    if (err) {
      this.onRunnable(err, undefined);
      let code = -1;
      if (err.errno) code = -err.errno;
      this.exit(code);
      return;
    }
    this.exeFd = fd;
    this.kernel.fs.fstat(fd, (serr: any, stats: any) => {
      if (serr) {
        this.onRunnable(serr, undefined);
        let code = -1;
        if (serr.errno) code = -serr.errno;
        this.exit(code);
        return;
      }
      let buf = new Buffer(stats.size);
      this.kernel.fs.read(fd, buf, 0, stats.size, 0, this.fileRead.bind(this, fd));
    });
  }

  fileRead(fd: number, err: any, bytesRead: number, buf: Buffer): void {
    // we don't care about errors, just releasing resources
    this.kernel.fs.close(fd, function (e?: any): void {});

    if (err) {
      this.onRunnable(err, undefined);
      this.exit(-1);
      return;
    }

    function isShebang(buf: Buffer): boolean {
      return (
        buf.length > 2 && buf.readUInt8(0) === 0x23 /*'#'*/ && buf.readUInt8(1) === 0x21 /*'!'*/
      );
    }

    function isWasm(buf: Buffer): boolean {
      return (
        buf.length > 4 &&
        buf.readUInt8(0) === 0x00 /*null*/ &&
        buf.readUInt8(1) === 0x61 /*'a'*/ &&
        buf.readUInt8(2) === 0x73 /*'s'*/ &&
        buf.readUInt8(3) === 0x6d /*'m'*/
      );
    }

    // Some executables (typically scripts) have a shebang
    // line that specifies an interpreter to use on the
    // rest of the file.  Check for that here, and adjust
    // things accordingly.
    //
    // TODO: abstract this into something like a binfmt
    // handler
    if (isShebang(buf)) {
      let newlinePos = buf.indexOf('\n');
      if (newlinePos < 0) throw new Error('shebang with no newline: ' + buf);
      let shebang = buf.slice(2, newlinePos).toString();
      buf = buf.slice(newlinePos + 1);

      let parts = shebang.match(/\S+/g);
      let cmd = parts[0];

      // many commands don't want to hardcode the
      // path to the interpreter (for example - on
      // OSX node is located at /usr/local/bin/node
      // and on Linux it is typically at
      // /usr/bin/node).  This type of issue is
      // worked around by using /usr/bin/env $EXE,
      // which consults your $PATH.  We special case
      // that here for 2 reasons - to avoid
      // implementing env (minor), and as a
      // performance improvement (major).
      if (parts.length === 2 && (parts[0] === '/usr/bin/env' || parts[0] === '/bin/env')) {
        cmd = '/usr/bin/' + parts[1];
      }

      // make sure this argument is an
      // absolute-valued path.
      this.pendingArgs[0] = this.pendingExePath;

      this.pendingArgs = [cmd].concat(this.pendingArgs);

      // OK - we've changed what our executable is
      // at this point so we need to read in the new
      // exe.
      this.kernel.fs.open(cmd, 'r', this.fileOpened.bind(this));
      return;
    } else if (isWasm(buf)) {
      this.pendingArgs = ['/usr/bin/ld'].concat(this.pendingArgs);
      this.kernel.fs.open('/usr/bin/ld', 'r', this.fileOpened.bind(this));
      return;
    }

    let jsBytes = new Uint8Array((<any>buf).data.buff.buffer);
    let blob = new Blob([jsBytes], { type: 'text/javascript' });
    jsBytes = undefined;
    let blobUrl = window.URL.createObjectURL(blob);

    // keep a reference to the URL so that we can use it for fork().
    this.blobUrl = blobUrl;

    this.blobReady(blobUrl);
  }

  blobReady(blobUrl: string): void {
    if (this.worker) {
      this.worker.onmessage = undefined;
      this.worker.terminate();
      this.worker = undefined;
    }
    this.timeWorkerStart = performance.now();
    this.worker = new Worker(blobUrl);
    this.worker.onmessage = this.syscallHandler.bind(this);
    this.worker.onerror = (err: ErrorEvent): void => {
      // if we're already a zombie, we have already
      // exited the process (according to the
      // kernel's record keeping) through an explict
      // exit() call.  Ignore this onerror message.
      if (this.state === TaskState.Zombie) return;

      // in this case, our onerror handler was
      // called before we received any explicit exit
      // message

      // console.log("onerror arrived before exit() syscall");

      if (this.files[2]) {
        console.log(err);
        let msg = new Buffer(
          'Error while executing ' + this.pendingExePath + ': ' + err.message + '\n',
          'utf8',
        );
        this.files[2].write(msg, -1, () => {
          // setTimeout on purpose
          setTimeout(() => {
            this.kernel.exit(this, -1);
          });
        });
      } else {
        // setTimeout on purpose
        setTimeout(() => {
          this.kernel.exit(this, -1);
        });
      }
    };

    let heap = this.heap;
    let args = this.forkArgs;

    this.heap = undefined;
    this.forkArgs = undefined;

    this.args = this.pendingArgs;
    this.env = this.pendingEnv;
    this.exePath = this.pendingExePath;
    this.pendingArgs = undefined;
    this.pendingEnv = undefined;
    this.pendingExePath = undefined;

    this.signal(
      'init',
      [this.args, this.env, this.kernel.debug, this.pid, heap, args],
      heap ? [heap] : null,
    );

    this.onRunnable(null, this.pid);
    this.onRunnable = undefined;
  }

  // returns 0 on success, -1 on failure
  setPriority(prio: number): number {
    // TODO: on UNIX, only root can 'nice down' - AKA
    // increase their priority by being less-nice.  We
    // don't enforce that here - essentially everyone is
    // root.
    this.priority += prio;
    if (this.priority < PRIO_MIN) this.priority = PRIO_MIN;
    if (this.priority >= PRIO_MAX) this.priority = PRIO_MAX - 1;
    return 0;
  }

  wait4(
    pid: number,
    options: number,
    cb: (pid: number, wstatus?: number, rusage?: any) => void,
  ): void {
    if (pid < -1) {
      console.log('TODO: wait4 with pid < -1');
      cb(-constants.ECHILD);
    }
    if (options) {
      console.log('TODO: non-zero options');
    }

    for (let i = 0; i < this.children.length; i++) {
      let child = this.children[i];
      if (pid !== -1 && pid !== 0 && child.pid !== pid) continue;
      // we have a child that matches, but it is still
      // alive.  Sleep until the child meets its maker.
      if (child.state !== TaskState.Zombie) {
        this.waitQueue.push([pid, options, cb]);
        return;
      }
      // at this point, we have a zombie that matches our filter
      // TODO: fill in rest of wstatus
      // lowest 8 bits is return value
      let wstatus = (child.exitCode >>> 0) % (1 << 8);
      cb(child.pid, wstatus, null);
      // reap the zombie!
      this.kernel.wait(child.pid);
      this.children.splice(i, 1);
      return;
    }

    // no children match what the process wants to wait for,
    // so return ECHILD immediately
    cb(-constants.ECHILD);
  }

  childDied(pid: number, code: number): void {
    if (!this.waitQueue.length) {
      this.signal('child', [pid, code, 0]);
      return;
    }

    // FIXME: this is naiive, and can be optimized
    let queue = this.waitQueue;
    this.waitQueue = [];
    for (let i = 0; i < queue.length; i++) {
      this.wait4.apply(this, queue[i]);
    }

    // TODO: sigchld is IGN by default.
    //this.signal('child', [pid, code, 0]);
  }

  signal(name: string, args: any[], transferrable?: any[]): void {
    // TODO: signal mask
    this.schedule(
      {
        id: -1,
        name: name,
        args: args,
      },
      transferrable,
    );
  }

  // run is called by the kernel when we are selected to run by
  // the scheduler
  schedule(msg: SyscallResult, transferrable?: any[]): void {
    // this may happen if we have an async thing that
    // eventually results in a syscall response, but we've
    // killed the process in the meantime.
    if (this.state === TaskState.Zombie) return;

    this.state = TaskState.Running;

    if (STRACE) {
      let add = ' ';
      if (msg.args && msg.args.length > 1) {
        if (msg.args[1].constructor !== Uint8Array) add += msg.args[1];
        else add += msg.args[1].byteLength;
      }
      console.log('[' + this.pid + '|' + msg.id + '] \tDONE' + add); // ' + JSON.stringify(msg));
    }
    this.worker.postMessage(msg, transferrable || []);
  }

  exit(code: number): void {
    this.state = TaskState.Zombie;
    this.exitCode = code;

    this.onRunnable = undefined;
    this.blobUrl = undefined;

    // only show perf information for emscripten programs for now
    // if (this.timeFirstMsg) {
    // 	let exit = performance.now();
    // 	console.log('' + this.pid + ' real: ' + (exit - this.timeWorkerStart));
    // 	console.log('' + this.pid + ' init: ' + (this.timeFirstMsg - this.timeWorkerStart));
    // 	console.log('' + this.pid + ' sys:  ' + this.timeSyscallTotal);
    // }

    for (let n in this.files) {
      if (!this.files.hasOwnProperty(n)) continue;
      if (this.files[n]) {
        this.files[n].unref();
        this.files[n] = undefined;
      }
    }

    if (this.worker) {
      this.worker.onmessage = undefined;
      this.worker.terminate();
      this.worker = undefined;
    }

    this.sheap = null;
    this.heapu8 = null;
    this.heap32 = null;

    // our children are now officially orphans.  re-parent them,
    // if possible
    for (let i = 0; i < this.children.length; i++) {
      let child = this.children[i];
      child.parent = this.parent;
      // if our process was careless and left zombies
      // hanging around, deal with that now.
      if (!child.parent && child.state === TaskState.Zombie) this.kernel.wait(child.pid);
    }

    if (this.parent) this.parent.childDied(this.pid, code);

    if (this.onExit) this.onExit(this.pid, this.exitCode);

    // if we have no parent, and there is no init process yet to
    // reparent to, reap the zombies ourselves.
    if (!this.parent) this.kernel.wait(this.pid);
  }

  private nextMsgId(): number {
    return ++this.msgIdSeq;
  }

  private syscallHandler(ev: MessageEvent): void {
    // TODO: there is probably a better way to handle this :\
    if (ev.data.trap) {
      this.syncSyscallStart = performance.now();
      this.syncSyscall(ev.data.trap, ev.data.args);
      return;
    }

    let syscall = Syscall.From(this, ev);
    if (!syscall) {
      console.log('bad syscall message, dropping');
      return;
    }

    // we might have queued up some messages from a process
    // that is no longer considered alive - silently discard
    // them if that is the case.
    if (this.state === TaskState.Zombie) return;

    this.state = TaskState.Interruptable;

    // many syscalls influence not just the state
    // maintained in this task structure, but state in the
    // kernel.  To easily capture this, route all syscalls
    // into the kernel, which may call back into this task
    // if need be.
    this.kernel.doSyscall(syscall);
  }
}
