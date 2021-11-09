// Copyright 2016 The Browsix Authors. All rights reserved.
// Use of this source code is governed by the ISC
// license that can be found in the LICENSE file.

'use strict';

import { Pipe } from './pipe';
import { BaseFile, File } from '../fs/core/file';
import type { CallbackOneArg, CallbackTwoArgs } from '../fs/core/file_system';
import { ERROR_MAP } from '../wasi/constants';
import { ApiError, ErrorCode } from '../fs/core/api_error';
import type { Process } from './process';
import type stats from '../fs/core/stats';

export interface AcceptCallback {
  (err: Error, s?: SocketFile, remoteAddr?: string, remotePort?: number): void;
}

export interface ConnectCallback {
  (err: Error, s?: SocketFile, remoteAddr?: string, remotePort?: number): void;
}

export function isSocket(f: File): f is SocketFile {
  return f instanceof SocketFile;
}

export interface Incoming {
  socket: SocketFile;
  addr: string;
  port: number;
  cb: AcceptCallback;
}

export class SocketFile extends BaseFile implements File {
  process: Process;
  isListening: boolean = false;
  parent: SocketFile = undefined;
  refCount: number = 1;

  port: number;
  addr: string;

  peer: SocketFile = undefined;

  outgoing: Pipe = undefined;
  incoming: Pipe = undefined;

  incomingQueue: Incoming[] = [];
  acceptQueue: AcceptCallback[] = [];

  constructor(process: Process) {
    super();
    this.process = process;
  }

  writeSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }

  listen(cb: (err: number) => void): void {
    this.isListening = true;
    cb(0);
  }

  accept(cb: AcceptCallback): void {
    if (!this.incomingQueue.length) {
      this.acceptQueue.push(cb);
      return;
    }

    let queued = this.incomingQueue.shift();

    let remote = queued.socket;
    let local = new SocketFile(this.process);
    local.addr = queued.addr;
    local.port = queued.port;

    let outgoing = new Pipe();
    let incoming = new Pipe();

    // local -> outgoing -> remote
    local.outgoing = outgoing;
    remote.incoming = outgoing;

    // remote -> incoming -> local
    local.incoming = incoming;
    remote.outgoing = incoming;

    local.peer = remote;
    remote.peer = local;

    cb(undefined, local, queued.addr, queued.port);
    queued.cb(null);
  }

  doAccept(remote: SocketFile, remoteAddr: string, remotePort: number, cb: AcceptCallback): void {
    if (!this.acceptQueue.length) {
      this.incomingQueue.push({
        socket: remote,
        addr: remoteAddr,
        port: remotePort,
        cb: cb,
      });
      return;
    }

    let acceptCB = this.acceptQueue.shift();

    let local = new SocketFile(this.process);
    local.addr = remoteAddr;
    local.port = remotePort;

    let outgoing = new Pipe();
    let incoming = new Pipe();

    // local -> outgoing -> remote
    local.outgoing = outgoing;
    remote.incoming = outgoing;

    // remote -> incoming -> local
    local.incoming = incoming;
    remote.outgoing = incoming;

    local.peer = remote;
    remote.peer = local;

    acceptCB(undefined, local, remoteAddr, remotePort);
    cb(null);
  }

  connect(addr: string, port: number, cb: ConnectCallback): void {
    this.process.kernel.net.connect(this, addr, port, cb);
  }

  read(
    buf: Buffer,
    pos: number,
    length = buf.length,
    position: number | undefined = undefined,
    cb: CallbackOneArg = () => {},
  ): number {
    if (pos !== -1) return cb(new ApiError(ERROR_MAP['ESPIPE']));

    this.incoming.read(buf, 0, length, undefined, cb);
  }

  write(
    buf: Buffer,
    offset: number,
    length: number,
    pos: number,
    cb: CallbackTwoArgs<number>,
  ): void {
    if (pos !== -1) return cb(new ApiError(ErrorCode.ESPIPE));
    this.outgoing.writeBuffer(buf, offset, length, pos, cb);
  }

  readSync(buf: Buffer, offset: number, length: number, pos: number): number {
    return this.incoming.readSync(buf, offset, length, pos);
  }

  ref(): void {
    this.refCount++;
    if (this.outgoing) this.outgoing.ref();
    if (this.incoming) this.incoming.ref();
  }

  unref(): void {
    if (this.outgoing) this.outgoing.unref();
    if (this.incoming) this.incoming.unref();
    this.refCount--;
    if (!this.refCount) {
      if (this.isListening) this.process.kernel.net.unbind(this, this.addr, this.port);
    }
  }

  stat(cb: (err: any, stats: any) => void): void {
    throw new Error('TODO: SocketFile.stat not implemented');
  }

  readdir(cb: (err: any, files: string[]) => void): void {
    setTimeout(cb, 0, 'cant readdir on normal file');
  }

  getPos(): number {
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
}
