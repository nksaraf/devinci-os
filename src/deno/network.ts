import { Resource } from './interface';
import type { Kernel } from './denix';
import { op_sync, op_async } from './interfaces';

export const network = [
  op_sync('op_net_listen', function (this: Kernel, args): OpConn {
    switch (args.transport) {
      case 'tcp': {
        console.log('tcp listener', args);

        let socket = new Socket();

        // socket.bind({
        //   hostname: args.hostname,
        //   port: args.port,
        // });
        let listenerRid = this.addResource(new TcpListenerResource(socket));

        // socket.listen();
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
    console.log('tcp accept', args);

    let listener = this.getResource<TcpListenerResource>(args.rid);

    let tcpStream = await listener.socket.accept();

    let streamRid = this.addResource(new TcpStreamResource(tcpStream));
    return {
      rid: streamRid,
      localAddr: tcpStream.localAddr,
      remoteAddr: tcpStream.peerAddr,
    };
  }),
  op_async('op_net_connect', async function (this: Kernel, args): Promise<OpConn> {
    switch (args.transport) {
      case 'tcp': {
        console.log('tcp listener', args);

        let socket = new Socket();
        let listenerRid = this.addResource(new TcpListenerResource(socket));

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
  {
    name: 'op_fetch',
    sync: function (this: Kernel, arg) {
      // return fetch(arg.url, {
      //   headers: arg.headers,
      //   method: arg.method,
      // });
      console.log(arg);
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
    async: async (arg) => {
      return arg;
    },
  },

  {
    name: 'op_fetch_send',
    // sync: (arg) => {
    //   // return fetch(arg.url, {
    //   //   headers: arg.headers,
    //   //   method: arg.method,
    //   // });
    //   let requestRid = this.addResource(new Resource());
    //   return { requestRid, requestBodyRid: null };
    // },
    async: async function (this: Kernel, rid: number) {
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
    },
  },
];

class TcpStreamResource extends Resource {
  constructor(public stream: TcpStream) {
    super();
  }
}
class TcpStream {
  localAddr: OpAddr;
  peerAddr: OpAddr;
}
interface OpConn {
  rid: number;
  localAddr?: OpAddr;
  remoteAddr?: OpAddr;
}
class Socket {
  listen() {
    throw new Error('Method not implemented.');
  }
  bind(arg0: { hostname: any; port: any }) {
    throw new Error('Method not implemented.');
  }
  async accept(): Promise<TcpStream> {
    throw new Error('Method not implemented.');
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
enum AddrType {
  Tcp,
  Udp,
  Unix,
  UnixPacket,
}

class FetchResponseResource extends Resource {
  reader: ReadableStreamDefaultReader;
  constructor(public response: Response) {
    super();
    let reader = response.body.getReader();
    // let stream = new ReadableStream({
    //   type: 'bytes' as const,
    //   async pull(controller) {
    //     let { done, value } = await reader.read();
    //     if (done) {
    //       controller.close();
    //     }
    //     controller.enqueue(value);
    //   },
    // });
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
