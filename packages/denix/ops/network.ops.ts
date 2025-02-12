import type { Process } from '../kernel.ts';
import { op_async, op_sync, Resource } from '../types.ts';

export const network = [
  op_sync('op_net_listen', function (this: Process, args): OpConn {
    switch (args.transport) {
      case 'tcp': {
        console.debug('tcp listener', args);

        let socket = new Socket(this);

        socket.listen(this, {
          hostname: args.hostname,
          port: args.port,
        });

        let listenerRid = this.addResource(new TcpListenerResource(socket));

        return {
          rid: listenerRid,
          localAddr: {
            hostname: args.hostname,
            port: args.port,
          },
          remoteAddr: undefined,
        };
      }
    }
  }),
  op_async('op_net_accept', async function (this: Process, args): Promise<OpConn> {
    console.debug('starting to accept', args);

    let listener = this.getResource<TcpListenerResource>(args.rid);

    let clientSocket = await listener.socket.accept();
    console.debug('accepted', args);

    let streamRid = this.addResource(new TcpStreamResource(clientSocket));

    return {
      rid: streamRid,
      localAddr: clientSocket.addr,
      remoteAddr: clientSocket.peerAddr,
    };
  }),
  op_async('op_net_connect', async function (this: Process, args): Promise<OpConn> {
    switch (args.transport) {
      case 'tcp': {
        console.debug('tcp listener', args);

        let socket = new Socket(this);
        let listenerRid = this.addResource(new TcpListenerResource(socket));

        // DNS resolution
        // Will look at a routing table

        // socket.bind(args.addr);
        // socket.listen(args.addr);
        return {
          rid: listenerRid,
          localAddr: {
            hostname: args.hostname,
            port: args.port,
          },
        };
      }
    }
  }),

  op_sync('op_http_start', function (this: Process, rid): number {
    let stream = this.getResource<TcpStreamResource>(rid);
    return this.addResource(new HttpConnResource(stream));
  }),

  op_async('op_http_accept', async function (this: Process, rid): Promise<[number, any, any, any]> {
    let httpConn = this.getResource<HttpConnResource>(rid);

    let request = await httpConn.accept();

    let streamRid = -1;
    // if (request.bodyUsed) {
    //   streamRid = this.addResource(request.body);
    // }
    // debugger;
    return [rid, request.method, [...request.headers.entries()], request.url];
  }),
  op_async(
    'op_http_write_headers',
    async function (this: Process, [rid, status, headers], respBody): Promise<void> {
      let httpConn = this.getResource<HttpConnResource>(rid);
      console.debug('written response', console.debug(httpConn));

      await httpConn.sendResponse({
        body: respBody,
        status,
        headers,
      });

      // let request = await httpConn.accept();

      // let rid = -1;
      // if (request.bodyUsed) {
      //   streamRid = this.addResource(request.body);
      // }
      // debugger;
    },
  ),
  {
    name: 'op_fetch',
    sync: function (this: Process, arg) {
      let requestRid = this.addResource(
        new FetchRequestResource(
          arg.url,
          arg.method,
          arg.headers,
          arg.hasBody,
          arg.clientRid,
          arg.byteLength,
        ),
      );

      return { requestRid, requestBodyRid: null, cancelHandleRid: null };
    },
  },

  op_async('op_fetch_send', async function (this: Process, rid: number) {
    let httpRequest = this.getResource(rid) as FetchRequestResource;

    let url = new URL(httpRequest.url);
    if (url.protocol === 'file:') {
      let val = (await this.fs.readFile(url.pathname, 'utf-8', 0)) as string;

      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(val));
            controller.close();
          },
        }),
        {
          status: 200,
          statusText: 'OK',
        },
      );
      return {
        status: response.status,
        statusText: response.statusText,
        // headers: headers,
        url: response.url,
        responseRid: this.addResource(new FetchResponseResource(response)),
      };
    }

    let response = await fetch(httpRequest.url, {
      headers: httpRequest.headers,
      method: httpRequest.method,
    });

    let headers = [];
    for (let [key, value] of response.headers) {
      headers.push([key, value]);
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
      url: response.url,
      responseRid: this.addResource(new FetchResponseResource(response)),
    };
  }),
];

class BroadcastChannel extends EventTarget {
  constructor() {
    super();
  }
}

export class LocalNetwork extends EventTarget {
  constructor() {
    super();
    this.channel = new BroadcastChannel('localhost');
    this.channel.addEventListener('message', (event) => {
      if (event.data.type === 'HTTP_REQUEST') {
        const { url, requestId, port, ...props } = event.data;
        console.debug('REQUESTED data on port', port, typeof window === 'undefined');
        console.debug(this.listeners, props);

        if (this.listeners[port] && this.listeners[port].isListening) {
          console.debug('getting response');
          let tcpStream = this.listeners[port].doAccept({
            hostname: new URL(props.referrer).hostname,
            port: 9000,
          });

          console.debug(tcpStream);

          tcpStream;

          setTimeout(() => {
            tcpStream.dispatchEvent(new CustomEvent('packet', { detail: event.data }));
          }, 1);

          tcpStream.addEventListener('send', (event) => {
            console.debug('SENDING', event);
            this.channel.postMessage({
              type: 'RESPONSE',
              requestId,
              response: event.detail,
            });
          });
          console.debug('posted message');
        }
      }
    });
  }

  listen(socket) {
    this.channel.postMessage({
      type: 'LISTEN',
      port: socket.port,
    });

    console.debug('listening');
  }
  listeners: { [key: number]: Socket } = {};
  bind(addr, socket) {
    this.listeners[addr.port] = socket;
  }
}

class TcpStreamResource extends Resource {
  readable: ReadableStream;
  writable: WritableStream;

  constructor(public socket: Socket) {
    super();

    this.readable = this.socket.getReadable();
    this.writable = this.socket.getWritable();
  }
}

interface OpConn {
  rid: number;
  localAddr?: OpAddr;
  remoteAddr?: OpAddr;
}

export class Socket extends EventTarget {
  isListening: boolean;
  addr: OpAddr;
  peerAddr: OpAddr;
  listen(kernel: Process, addr: OpAddr) {
    kernel.net.bind(addr, this);
    kernel.net.listen(this);
    this.addr = addr;
    this.isListening = true;
    return;
  }

  constructor(public kernel: Process) {
    super();
    this.addEventListener('packet', (event) => {
      console.debug('packet', event.detail);
    });
  }

  acceptResolve;
  acceptReject;

  getReadable() {
    return new ReadableStream({
      start: (con) => {
        function handleData(event) {
          console.debug('heree', new TextEncoder().encode(JSON.stringify(event.detail)));
          con.enqueue(new TextEncoder().encode(JSON.stringify(event.detail)));
        }

        this.addEventListener('packet', handleData);

        this.addEventListener(
          'close',
          () => {
            this.removeEventListener('packet', handleData);
            con.close();
          },
          { once: true },
        );
      },
    });
  }

  getWritable() {
    return new WritableStream({
      write: (chunk) => {
        console.debug('written');
        this.dispatchEvent(new CustomEvent('send', { detail: chunk }));
      },
    });
  }

  // when a new client comes in, we create a new socket to handle that communication
  doAccept(remoteAddr: OpAddr) {
    const socket = new Socket(this.kernel);
    socket.peerAddr = remoteAddr;
    socket.addr = this.addr;
    this.acceptResolve(socket);
    this.acceptResolve = null;
    this.acceptReject = null;
    return socket;
  }

  async accept(): Promise<Socket> {
    const promise = new Promise<any>((res, rej) => {
      this.acceptResolve = res;
      this.acceptReject = rej;
    });
    return await promise;
  }
}

class TcpListenerResource extends Resource {
  constructor(public socket: Socket) {
    super();
  }

  close() {}
}

interface OpAddr {
  hostname: string;
  port: number;
}

class HttpConnResource extends Resource {
  constructor(public stream: TcpStreamResource) {
    super();
  }

  acceptResolve;
  acceptReject;

  doAccept(request: Request) {
    // const stream = new TcpStream();
    // const rid = this.kernel.addResource(new TcpStreamResource(stream));
    this.acceptResolve(request);
  }

  async sendResponse(response) {
    await this.stream.writable.getWriter().write(response);
  }

  async accept(): Promise<Request> {
    if (!this.stream.readable.locked) {
      this.stream.readable.pipeTo(
        new WritableStream({
          write: (chunk, controller) => {
            let req = JSON.parse(new TextDecoder().decode(chunk));
            this.acceptResolve(
              new Request(req.url, {
                method: req.method,
                headers: req.headers,
              }),
            );
            this.acceptResolve = null;
            this.acceptReject = null;
          },
        }),
      );
    }
    if (this.acceptResolve) {
      throw new Error('already accepting');
    }
    const promise = new Promise<Request>((res, rej) => {
      this.acceptResolve = res;
      this.acceptReject = rej;
    });
    return await promise;
  }

  close() {
    console.debug('closing');
  }
}

enum AddrType {
  Tcp,
  Udp,
  Unix,
  UnixPacket,
}

class Reader extends Resource {
  reader: ReadableStreamDefaultReader;
  constructor(public stream: ReadableStream) {
    super();
    let reader = stream.getReader();
    this.reader = reader;
  }

  currentChunkOffset = 0;
  currentChunk: Uint8Array;

  async read(data: Uint8Array) {
    if (!this.currentChunk || this.currentChunkOffset >= this.currentChunk.length) {
      let { done, value } = await this.reader.read();
      if (done) {
        return 0;
      }

      this.currentChunk = value;
      this.currentChunkOffset = 0;
    }

    let remainingData = this.currentChunk.length - this.currentChunkOffset;
    console.debug({ remainingData, chunk: this.currentChunk, offset: this.currentChunkOffset });
    if (remainingData > data.length) {
      data.set(
        this.currentChunk.slice(this.currentChunkOffset, this.currentChunkOffset + data.length),
      );
      this.currentChunkOffset += data.length;
      return data.length;
    } else {
      data.set(this.currentChunk.slice(this.currentChunkOffset));
      let dataWritten = this.currentChunk.length - this.currentChunkOffset;

      this.currentChunkOffset += this.currentChunk.length - this.currentChunkOffset;
      return dataWritten;
    }
  }
}

class FetchResponseResource extends Reader {
  constructor(public response: Response) {
    super(response.body);
  }
}

class FetchRequestResource extends Resource {
  constructor(
    public url: string,
    public method: string,
    public headers: [[string, string]],
    public hasBody: boolean,
    public clientRid: number,
    public byteLength: number,
  ) {
    super();
  }
}
