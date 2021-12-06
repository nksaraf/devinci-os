import { expose, proxy, wrap } from '$lib/comlink/mod';
import { RemoteFileSystem } from '$lib/fs/remote';
import { Process } from 'os/lib/denix/kernel';
import type { ProcessOptions } from 'os/lib/denix/kernel';
import { RemoteProcessManager } from './remote_proc_manager';
import { VirtualFileSystem } from '../fs/virtual';

export type RemoteProcessOptions = Partial<ProcessOptions> & {
  fsPort: MessagePort;
  procPort: MessagePort;
};

export class RemoteProcess extends Process {
  constructor() {
    super();
  }

  fsRemote: RemoteFileSystem;

  async start(options: RemoteProcessOptions) {
    console.debug('here', options);
    let proc = new RemoteProcessManager();
    proc.proxy = wrap(await options.procPort);
    this.fsRemote = new RemoteFileSystem(undefined, true);
    this.fsRemote.proxy = wrap(await options.fsPort);
    await this.fsRemote.proxy.ready();

    this.fs = new VirtualFileSystem(this.fsRemote);

    await super.init({
      fs: this.fs,
      proc: proc,
      // fsRemote: fsRemote,
      pid: await options.pid,
      parentPid: await options.parentPid,
      stdin: await options.stdin,
      stdout: await options.stdout,
      stderr: await options.stderr,
      env: await options.env,
      resourceTable: await options.resourceTable,
      net: await options.net,
      cwd: await options.cwd,
      cmd: await options.cmd,
      // tty: await options.tty,
    });

    super.run();
  }

  async getResourceTable() {
    return this.resourceTable;
  }
}

let process = new RemoteProcess();

expose({
  addEventListener: process.addEventListener.bind(process),
  spawn: async (options: RemoteProcessOptions) => {
    await process.start(options);

    Reflect.defineProperty(navigator, 'process', {
      value: process,
    });

    return proxy(process);
  },
});
