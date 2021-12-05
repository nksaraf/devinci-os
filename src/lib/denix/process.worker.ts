import { expose, proxy, wrap } from '$lib/comlink/mod';
import { fs as globalFS } from '$lib/fs';
import { RemoteFileSystem } from '$lib/fs/remote';
import { Process } from '$lib/denix/denix';
import type { ProcessOptions } from '$lib/denix/denix';
import { RemoteProcessManager } from './remote_proc_manager';

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
    console.log('here', options);
    this.fsRemote = new RemoteFileSystem(undefined, true);
    globalFS.rootFs = this.fsRemote;
    this.fsRemote.proxy = wrap(await options.fsPort);

    let proc = new RemoteProcessManager();

    proc.proxy = wrap(await options.procPort);

    await this.fsRemote.proxy.ready();
    await super.init({
      fs: globalFS,
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

expose({
  spawn: async (options: RemoteProcessOptions) => {
    let process = new RemoteProcess();
    await process.start(options);

    Reflect.defineProperty(navigator, 'process', {
      value: process,
    });

    return proxy(process);
  },
});
