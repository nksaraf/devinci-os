import '$lib/service-worker';
import { fs as globalFS } from '$lib/fs';
import { RemoteFileSystem } from '$lib/fs/remote';
import { Process } from '$lib/denix/denix';
import { proxy, wrap } from '../comlink/mod';
import type { Remote } from '../comlink/mod';
import type { RemoteProcessOptions } from './process.worker';
import { createResourceTable } from './types';
import InMemoryFileSystem from '../fs/inmemory';
import type { File } from '../fs/core/file';
import { TTY } from '../tty/tty';
import { ApiError } from '../error';
import Stats, { FileType } from '../fs/core/stats';

declare global {
  interface Navigator {
    process: MainProcess;
  }
}

class DeviceFileSystem extends InMemoryFileSystem {
  constructor() {
    super();
  }

  openedFiles = new Map<string, File>();

  public async readdir(p: string): Promise<string[]> {
    if (p === '/') {
      return [...this.openedFiles.keys()].map((p) => p.slice(1));
    }
  }

  async stat(p: string) {
    if (this.openedFiles.has(p)) {
      return (this.openedFiles.get(p) as TTY).getStats();
    }

    if (p === '/') return new Stats(FileType.DIRECTORY, 1);

    throw ApiError.ENOENT(p);
  }

  public async createFile(p: string, flag: number, mode: number): Promise<File> {
    let tty = new TTY('/dev' + p);
    this.openedFiles.set(p, tty);
    return tty;
  }

  public async open(p: string, flag: number, mode: number): Promise<File> {
    if (this.openedFiles.has(p)) {
      return this.openedFiles.get(p);
    }

    return await this.createFile(p, flag, mode);
  }
}

let NEXT_PROCESS_ID = 1;
class MainProcess extends Process {
  constructor() {
    super();
  }

  get name() {
    return 'main';
  }

  async init() {
    const fsWorker = new Worker(new URL('./fs.worker.ts?worker_file', import.meta.url).href, {
      type: 'module',
      name: 'filesystem',
    });

    let fsRemote = new RemoteFileSystem(fsWorker, false);

    globalFS.rootFs = fsRemote;

    await fsRemote.proxy.ready();

    await globalFS.mount('/dev', new DeviceFileSystem());

    const tty = (await globalFS.open('/dev/tty0', 1, 0x666)) as TTY;

    await super.init({
      pid: 0,
      fs: globalFS,
      fsRemote,
      fsWorker,
      cmd: ['bootup'],
      cwd: '/',
      env: {},
      tty,
    });
  }

  async spawn({
    cmd,
    pid = NEXT_PROCESS_ID++,
    cwd = this.cwd,
    env = this.env,
    parentPid = this.pid,
    resourceTable = createResourceTable(),
    tty,
  }: Partial<RemoteProcessOptions>) {
    const worker = wrap<{ spawn: (options: RemoteProcessOptions) => Promise<Remote<Process>> }>(
      new Worker(new URL('./process.worker.ts?worker-file', import.meta.url).href, {
        type: 'module',
        name: `${cmd.join(' ')} (${pid})`,
      }),
    );

    let parent = this;

    // we want to be able to get a new fs connection for each process
    let fs = await this.fsRemote.proxy.newConnection();

    // inherit mode
    resourceTable[0] = resourceTable[0] ?? parent.resourceTable[0];
    resourceTable[1] = resourceTable[1] ?? parent.resourceTable[1];
    resourceTable[2] = resourceTable[2] ?? parent.resourceTable[2];

    let process = await worker.spawn(
      proxy({
        parentPid: parentPid,
        pid: pid,
        fsPort: fs,
        stdin: 0,
        stdout: 1,
        stderr: 2,
        cmd: cmd,
        resourceTable,
        cwd,
        env,
        tty,
      }),
    );

    return process;
  }
}

export const main = new MainProcess();
await main.init();

Reflect.defineProperty(navigator, 'process', {
  value: main,
});
