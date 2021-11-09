import '../node/polyfill';
import type MountableFileSystem from '../fs/backend/MountableFileSystem';
import type { File } from '../fs/core/file';
import type { CallbackTwoArgs, CallbackOneArg, BFSThreeArgCallback } from '../fs/core/file_system';
import type stats from '../fs/core/stats';
import { createFileSystem, createFileSystemSync, KernelFileSystem } from '../fs/create-fs';
import { ProcessManager } from './process';
import Global from '../global';
import { expose } from 'comlink';
import type { ConnectCallback, SocketFile } from './socket';
import { ApiError, ErrorCode } from '../fs/core/api_error';

class TTYFile implements File {
  getPos(): number {
    throw new Error('Method not implemented.');
  }
  stat(cb: CallbackTwoArgs<stats>): void {
    throw new Error('Method not implemented.');
  }
  statSync(): stats {
    throw new Error('Method not implemented.');
  }
  close(cb: CallbackOneArg): void {
    throw new Error('Method not implemented.');
  }
  closeSync(): void {
    throw new Error('Method not implemented.');
  }
  truncate(len: number, cb: CallbackOneArg): void {
    throw new Error('Method not implemented.');
  }
  truncateSync(len: number): void {
    throw new Error('Method not implemented.');
  }
  sync(cb: CallbackOneArg): void {
    throw new Error('Method not implemented.');
  }
  syncSync(): void {
    throw new Error('Method not implemented.');
  }
  write(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    cb: BFSThreeArgCallback<number, Buffer>,
  ): void {
    throw new Error('Method not implemented.');
  }
  writeSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    cb: BFSThreeArgCallback<number, Buffer>,
  ): void {
    throw new Error('Method not implemented.');
  }
  readSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }
  datasync(cb: CallbackOneArg): void {
    throw new Error('Method not implemented.');
  }
  datasyncSync(): void {
    throw new Error('Method not implemented.');
  }
  chown(uid: number, gid: number, cb: CallbackOneArg): void {
    throw new Error('Method not implemented.');
  }
  chownSync(uid: number, gid: number): void {
    throw new Error('Method not implemented.');
  }
  chmod(mode: number, cb: CallbackOneArg): void {
    throw new Error('Method not implemented.');
  }
  chmodSync(mode: number): void {
    throw new Error('Method not implemented.');
  }
  utimes(atime: Date, mtime: Date, cb: CallbackOneArg): void {
    throw new Error('Method not implemented.');
  }
  utimesSync(atime: Date, mtime: Date): void {
    throw new Error('Method not implemented.');
  }
}

export class Network {
  ports: { [port: number]: SocketFile } = {};
  connect(f: File, addr: string, port: number, cb: ConnectCallback): void {
    if (addr === '0.0.0.0') addr = '127.0.0.1';
    if (addr !== 'localhost' && addr !== '127.0.0.1') {
      console.log('TODO connect(): only localhost supported for now');
      cb(new ApiError(ErrorCode.ECONNREFUSED));
      return;
    }

    if (!(port in this.ports)) {
      cb(new ApiError(ErrorCode.ECONNREFUSED));
      return;
    }

    let listener = this.ports[port];
    if (!listener.isListening) {
      cb(new ApiError(ErrorCode.ECONNREFUSED));
      return;
    }

    let local = <SocketFile>(<any>f);
    listener.doAccept(local, addr, port, cb);
  }

  unbind(s: File, addr: string, port: number): any {
    if (!(port in this.ports)) return;
    if (s !== this.ports[port]) {
      console.log('unbind for wrong port?');
      return;
    }

    let f = this.ports[port];
    f.closeSync();
    delete this.ports[port];
  }

  bind(s: SocketFile, addr: string, port: number, cb: (err: number) => void): any {
    if (port in this.ports) return 'port ' + port + ' already bound';
    this.ports[port] = s;
    s.port = port;
    s.addr = addr;
    cb(0);
  }
}

export class Kernel {
  static instance: Kernel;
  static fs: ProxyHandler<MountableFileSystem> = new Proxy(
    {},
    {
      get: (target, prop) => {
        // if (prop === 'mount') {
        //   return (mountPoint, fileSystem) => {
        //     console.log(`Mounting ${fileSystem.constructor.name} at ${mountPoint}`);
        //     target[mountPoint] = fileSystem;
        //   };
        // }
        return Kernel.instance.fs[prop];
      },
    },
  );

  // static path: typeof import('path');

  fs: MountableFileSystem;
  proc: ProcessManager;
  net: Network;

  async boot() {
    console.log('Booting kernel...');
    Kernel.instance = this;
    this.fs = new KernelFileSystem({});
    this.proc = new ProcessManager(this);
    this.net = new Network();
    this.proc.init();

    return null;
  }

  static log = console.log;
}

expose(Kernel);

Global.Kernel = Kernel;
