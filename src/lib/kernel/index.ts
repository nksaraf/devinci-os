import type MountableFileSystem from '../fs/backend/MountableFileSystem';
import type { File } from '../fs/core/file';
import type { CallbackTwoArgs, CallbackOneArg, BFSThreeArgCallback } from '../fs/core/file_system';
import type stats from '../fs/core/stats';
import { createFileSystem, createFileSystemSync } from '../fs/create-fs';

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

export class Process {
  cwd: string;
  env: { [key: string]: string };
  argv: string[];
  stdin: TTYFile;
  stdout: TTYFile;
  stderr: TTYFile;
  chdir(path: string): void {
    this.cwd = path;
  }
  files: { [key: number]: File };
  constructor() {}
}

export class Kernel {
  static fs: MountableFileSystem;
  static path: typeof import('path');

  static async init() {
    Kernel.fs = createFileSystemSync({});
    return;
  }

  static spawn(argv) {}

  static processes: {
    [pid: number]: Process;
  } = {};

  private static createProcess() {
    return new Process();
  }

  static log = console.log;
}

class MainProcess {}

import Global from '../global';

Global.Kernel = Kernel;