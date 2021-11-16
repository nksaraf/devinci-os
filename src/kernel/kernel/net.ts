// Copyright 2016 The Browsix Authors. All rights reserved.
// Use of this source code is governed by the ISC
// license that can be found in the LICENSE file.

'use strict';

import { InMemoryPipe } from './pipe';
import { BaseFile } from '../fs/core/file';
import type { File } from '../fs/core/file';
import { BaseFileSystem } from '../fs/core/file_system';
import type { CallbackOneArg, CallbackTwoArgs, IFileSystem } from '../fs/core/file_system';
import { ApiError, ErrorCode } from '../fs/core/api_error';
import type stats from '../fs/core/stats';
import type { Kernel } from './kernel';
import VirtualFile from '../fs/generic/virtual_file';
import { SyncKeyValueFile, SyncKeyValueFileSystem } from '../fs/generic/key_value_filesystem';
import type { FileFlagString } from '../fs/core/file_flag';
import type { IterableReadableStream } from './stream';

export interface AcceptCallback {
  (err: Error, s?: SocketFile, remoteAddr?: string, remotePort?: number): void;
}

export interface ConnectCallback {
  (err: Error, s?: SocketFile, remoteAddr?: string, remotePort?: number): void;
}

export function isSocket(f: File): f is Socket {
  return f instanceof Socket;
}

export interface Incoming {
  socket: SocketFile;
  addr: string;
  port: number;
  cb: AcceptCallback;
}

export class Network {
  channel: BroadcastChannel;

  kernel: Kernel;
  ports: { [port: number]: SocketFile } = {};
  constructor() {
    this.channel = new BroadcastChannel('network');
  }
  // createFileSync(p: string, flag: FileFlagString, mode: number): File {}
  socket() {
    return new SocketFile();
  }

  getConnection(port: MessagePort): SocketFile {
    return this.ports[port];
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
    this.lookup(addr, port, (err, ip, port) => {
      if (err) {
        onConnect(err);
        return;
      }

      if (!serverProxySocket.isListening) {
        onConnect(new ApiError(ErrorCode.ECONNREFUSED));
        return;
      }

      const messageChannel = new MessageChannel();

      clientSocket.readable = new ReadableStream({
        start(controller: ReadableStreamDefaultController) {
          messageChannel.port1.addEventListener('message', (event) => {
            controller.enqueue(event.data);
          });

          messageChannel.port1.addEventListener('close', () => {
            controller.close();
          });

          messageChannel.port1.addEventListener('err', () => {
            controller.error();
          });
        },
      });

      messageChannel.port1.start();

      clientSocket.writable;
      // actual server interaction
      serverProxySocket.doAccept(clientSocket, addr, port, onConnect);
    });

    // is a socket but not listening (probably client side)
  }

  lookup(addr: string, port: number, cb: (err: Error) => void): void {
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

    cb(null);
  }

  /// server side of BSD sockets
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

// class SocketFileSystem extends SyncKeyValueFileSystem {
//   openFileSync('/sockets/')
// }

export class Socket extends EventTarget implements File {
  kernel: Kernel = kernel;
  isListening: boolean = false;
  refCount: number = 1;
  sockfd: number;
  port: number;
  addr: string;

  peer: Socket = undefined;

  readable: ReadableStream = undefined;
  writable: WritableStream = undefined;

  waitingClients: Incoming[] = [];
  waitingForNewClients: AcceptCallback[] = [];

  listen(cb: (err: number) => void): void {
    this.isListening = true;
    cb(0);
  }

  accept(cb: AcceptCallback): void {
    // if no connection requests are in queue, the accept will block
    if (!this.waitingClients.length) {
      this.waitingForNewClients.push(cb);
      return;
    }

    // if there are connection requests in queue, we can now accept the first
    let queued = this.waitingClients.shift();

    let remote = queued.socket;
    let local = new SocketFile();
    local.addr = queued.addr;
    local.port = queued.port;

    let outgoing = new InMemoryPipe();
    let incoming = new InMemoryPipe();

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
    if (!this.waitingForNewClients.length) {
      this.waitingClients.push({
        socket: remote,
        addr: remoteAddr,
        port: remotePort,
        cb: cb,
      });
      return;
    }

    // if there were accept calls blocking,
    // we can now accept the incoming request
    let acceptCB = this.waitingForNewClients.shift();

    let local = new SocketFile();
    local.addr = remoteAddr;
    local.port = remotePort;

    let outgoing = new InMemoryPipe();
    let incoming = new InMemoryPipe();

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
    this.kernel.net.connect(this, addr, port, () => {
      let writeStream = new InMemoryPipe();
      let readStream = new InMemoryPipe();

      this.incoming = null;
      this.outgoing = null;

      cb(null);
      // local -> outgoing -> remote
      // local.outgoing = outgoing;
      // remote.incoming = outgoing;
    });
  }

  readBuffer(
    buf: Buffer,
    offset: number,
    length = buf.length,
    position: number | undefined = undefined,
    cb: CallbackOneArg = () => {},
  ): number {
    if (position !== -1) return cb(new ApiError(ErrorCode.ESPIPE));

    this.incoming.readBuffer(buf, 0, length, undefined, cb);
  }

  writeBuffer(
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
    return this.incoming.readBufferSync(buf, offset, length, pos);
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
}

interface SocketInit {}
interface SocketStats {}
interface SocketInfo {}

// Socket
// Server side:
//  - onconnect(port, cb)

interface ISocket extends EventTarget {
  update(object: SocketInit): Promise<boolean>;

  readonly readable: ReadableStream;
  readonly writable: WritableStream;

  readonly ready: Promise<boolean>;
  readonly closed: Promise<boolean>;

  abort(reason?: string): Promise<boolean>;
  readonly signal: AbortSignal;

  readonly stats: SocketStats;
  readonly info: SocketInfo;
}

class Socket extends EventTarget implements File {
  constructor(object: SocketInit) {
    super();
  }

  update(object: SocketInit): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  writable: WritableStream<any>;
  ready: Promise<boolean>;
  closed: Promise<boolean>;
  abort(reason?: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  signal: AbortSignal;
  stats: SocketStats;
  info: SocketInfo;

  _ready: boolean;
  _closed: boolean;

  get readable(): IterableReadableStream {
    return;
  }
}
