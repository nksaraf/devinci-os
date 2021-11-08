import type { File } from '../core/file';
import {
  FileSystem,
  BFSThreeArgCallback,
  CallbackOneArg,
  CallbackTwoArgs,
  SynchronousFileSystem,
} from '../core/file_system';
import type stats from '../core/stats';
import * as net from 'net';

class Socket extends net.Socket {
  constructor(fs: FileSystem);
}

class SocketFile implements File {
  fs: SocketFileSystem;
  constructor(addr: string, port: number, fs: FileSystem) {
    super();
  }
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

class SocketsFileSystem extends SynchronousFileSystem implements FileSystem {
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
    return false;
  }
  createFile;
}
