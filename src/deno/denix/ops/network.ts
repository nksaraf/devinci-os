import { Resource } from '../interfaces';
import type { Kernel } from '../denix';
import { op_sync, op_async } from '../interfaces';
import { pull } from 'isomorphic-git';

export const network = [
  op_sync('op_net_listen', function (this: Kernel, args): OpConn {
    switch (args.transport) {
      case 'tcp': {
        console.log('tcp listener', args);

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
  op_async('op_net_accept', async function (this: Kernel, args): Promise<OpConn> {
    console.log('starting to accept', args);

    let listener = this.getResource<TcpListenerResource>(args.rid);

    let clientSocket = await listener.socket.accept();
    console.log('accepted', args);

    let streamRid = this.addResource(new TcpStreamResource(clientSocket));

    return {
      rid: streamRid,
      localAddr: clientSocket.addr,
      remoteAddr: clientSocket.peerAddr,
    };
  }),
  op_async('op_net_connect', async function (this: Kernel, args): Promise<OpConn> {
    switch (args.transport) {
      case 'tcp': {
        console.log('tcp listener', args);

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

  op_sync('op_http_start', function (this: Kernel, rid): number {
    let stream = this.getResource<TcpStreamResource>(rid);
    return this.addResource(new HttpConnResource(stream));
  }),

  op_async('op_http_accept', async function (this: Kernel, rid): Promise<[number, any, any, any]> {
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
    async function (this: Kernel, [rid, status, headers], respBody): Promise<void> {
      let httpConn = this.getResource<HttpConnResource>(rid);
      console.log('written response', console.log(httpConn));

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
    sync: function (this: Kernel, arg) {
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

  op_async('op_fetch_send', async function (this: Kernel, rid: number) {
    let httpRequest = this.resourceTable.get(rid) as FetchRequestResource;
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

export class LocalNetwork extends EventTarget {
  channel = new BroadcastChannel('network');
  constructor() {
    super();
    this.channel.addEventListener('message', (event) => {
      if (event.data.type === 'HTTP_REQUEST') {
        const { url, requestId, port, ...props } = event.data;
        console.log('REQUESTED data on port', port, typeof window === 'undefined');
        console.log(this.listeners, props);

        if (this.listeners[port] && this.listeners[port].isListening) {
          // let writableStream = new WritableStream({
          //   write: (chunk) => {
          //     this.channel.postMessage({
          //       type: 'RESPONSE',
          //       requestId,
          //       data: chunk,
          //     });
          //   },
          // });

          // let readableStream = new ReadableStream({
          //   start: (controller) => {

          //   }
          // });

          let tcpStream = this.listeners[port].doAccept({
            hostname: new URL(props.referrer).hostname,
            port: 9000,
          });

          console.log(tcpStream);

          tcpStream;

          setTimeout(() => {
            tcpStream.dispatchEvent(new CustomEvent('packet', { detail: event.data }));
          }, 1000);

          tcpStream.addEventListener('send', (event) => {
            this.channel.postMessage({
              type: 'RESPONSE',
              requestId,
              response: event.detail,
            });
          });
          // new Request(url, {
          //   method: props.method,
          //   headers: props.headers,
          //   referrer: referrer,
          // }),
          //   console.log('posting message');
          // try {
          //   this.channel.postMessage({
          //     type: 'RESPONSE',
          //     data: 'HELLO FROM THE OTHER SIDE',
          //     requestId,
          //   });
          // } catch (e) {
          //   console.error('error in response', e);
          // }
          console.log('posted message');
        }
      }
    });
  }

  listen(socket) {
    this.channel.postMessage({
      type: 'LISTEN',
      port: socket.port,
    });

    console.log('listening');
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

    // this.readable = new ReadableStream({
    //   async pull(con) {
    //     let data = await this.socket.read();
    //     con.enqueue()

    //   }
    // });
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
  listen(kernel: Kernel, addr: OpAddr) {
    kernel.net.bind(addr, this);
    kernel.net.listen(this);
    this.addr = addr;
    this.isListening = true;
    return;
  }

  constructor(public kernel: Kernel) {
    super();
    this.addEventListener('packet', (event) => {
      console.log('packet', event.detail);
    });
  }

  acceptResolve;
  acceptReject;

  getReadable() {
    return new ReadableStream({
      start: (con) => {
        function handleData(event) {
          console.log('heree', new TextEncoder().encode(JSON.stringify(event.detail)));
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
        console.log('written');
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

  async read(data: Uint8Array) {
    let { done, value } = await this.reader.read();

    if (done) {
      return 0;
    } else {
      data.set(value);
      console.log('READ', done, value, data);

      return value.byteLength;
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
