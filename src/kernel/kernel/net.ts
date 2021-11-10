// Copyright 2016 The Browsix Authors. All rights reserved.
// Use of this source code is governed by the ISC
// license that can be found in the LICENSE file.

'use strict';

import { Pipe } from './pipe';
import { BaseFile } from '../fs/core/file';
import type { File } from '../fs/core/file';
import type { CallbackOneArg, CallbackTwoArgs } from '../fs/core/file_system';
import { ApiError, ErrorCode } from '../fs/core/api_error';
import type stats from '../fs/core/stats';
import type { Kernel } from './kernel';

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

export class Network {
  kernel: Kernel;
  ports: { [port: number]: SocketFile } = {};
  socket() {
    return new SocketFile(this.kernel);
  }
  // Client side of BSD Sockets.
  // An open socket file descriptor is passed in with the address and port of
  // the socket to connect to
  // Currently, we map the port to the local ports map, and then call the
  // accept on the socket file that is bound to that port.
  connect(clientSocket: SocketFile, addr: string, port: number, onConnect: ConnectCallback): void {
    console.log('connecting', clientSocket, addr, port);
    if (addr === '0.0.0.0') addr = '127.0.0.1';

    if (addr !== 'localhost' && addr !== '127.0.0.1') {
      console.log('TODO connect(): only localhost supported for now');
      onConnect(new ApiError(ErrorCode.ECONNREFUSED));
      return;
    }

    if (!(port in this.ports)) {
      onConnect(new ApiError(ErrorCode.ECONNREFUSED));
      return;
    }

    // this is kind of a IP + DNS search
    let listener = this.ports[port];

    // is a socket but not listening (probably client side)
    if (!listener.isListening) {
      onConnect(new ApiError(ErrorCode.ECONNREFUSED));
      return;
    }

    // actual server interaction
    listener.doAccept(clientSocket, addr, port, onConnect);
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

  bind(s: SocketFile, addr: string, port: number): any {
    if (port in this.ports) return 'port ' + port + ' already bound';
    this.ports[port] = s;
    s.port = port;
    s.addr = addr;
  }
}

export class SocketFile extends BaseFile implements File {
  kernel: Kernel;
  isListening: boolean = false;
  refCount: number = 1;
  sockfd: number;
  port: number;
  addr: string;

  peer: SocketFile = undefined;

  outgoing: Pipe = undefined;
  incoming: Pipe = undefined;

  incomingQueue: Incoming[] = [];
  acceptQueue: AcceptCallback[] = [];

  constructor(kernel: Kernel) {
    super();
    this.kernel = kernel;
    this.sockfd = this.kernel.process.getNextFD();
    this.kernel.process.files[this.sockfd] = this;
  }

  writeSync(buffer: Buffer, offset: number, length: number, position: number): number {
    throw new Error('Method not implemented.');
  }

  listen(cb: (err: number) => void): void {
    this.isListening = true;
    cb(0);
  }

  accept(cb: AcceptCallback): void {
    // if no connection requests are in queue, the accept will block
    if (!this.incomingQueue.length) {
      this.acceptQueue.push(cb);
      return;
    }

    // if there are connection requests in queue, we can now accept the first
    let queued = this.incomingQueue.shift();

    let remote = queued.socket;
    let local = new SocketFile(this.kernel);
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

    // callback to server with new local socket for connection
    cb(undefined, local, queued.addr, queued.port);

    // callback to client that client request was successful
    queued.cb(null);
  }

  // is the core of the networking stack,
  // when a new client tries to connect, this, the server side
  // socket, will do an accept

  // if this doAccept is called
  doAccept(remote: SocketFile, remoteAddr: string, remotePort: number, cb: AcceptCallback): void {
    // if accept queue is empty, i.e nobody is waiting to accept,
    // just add the incoming request to the incoming queue
    // when a server side socket will be ready accept, it will see this request
    if (!this.acceptQueue.length) {
      this.incomingQueue.push({
        socket: remote,
        addr: remoteAddr,
        port: remotePort,
        cb: cb,
      });
      return;
    }

    // if there were accept calls blocking,
    // we can now accept the incoming request
    let acceptCB = this.acceptQueue.shift();

    let local = new SocketFile(this.kernel);
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

    // tell the server that a new connected was made and send the new socket
    // local socket for this specific connection
    acceptCB(undefined, local, remoteAddr, remotePort);

    // tells the client that the connection was accepted
    cb(null);
  }

  connect(addr: string, port: number, cb: ConnectCallback): void {
    this.kernel.net.connect(this, addr, port, cb);
  }

  read(
    buf: Buffer,
    offset: number,
    length = buf.length,
    position: number | undefined = undefined,
    cb: CallbackOneArg = () => {},
  ): number {
    if (position !== -1) return cb(new ApiError(ErrorCode.ESPIPE));

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
      if (this.isListening) this.kernel.net.unbind(this, this.addr, this.port);
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
