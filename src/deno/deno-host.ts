import type { File } from '../kernel/fs/core/file';
import { constants } from '../kernel/kernel/constants';
import type { ResourceTable } from '../kernel/node/interface';
import { Resource } from '../kernel/node/interface';
import { Buffer } from 'buffer';
import type { Remote } from 'comlink';
import { wrap } from 'comlink';

function sendOpCall(opname, arg1, arg2) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/deno/op/sync/' + opname, false);
  xhr.send(JSON.stringify([opname, arg1, arg2]));
  // look ma, i'm synchronous (•‿•)
  console.log('json response', xhr.responseText);
  return JSON.parse(xhr.responseText.length > 0 ? xhr.responseText : 'null');
}

export class DenoRemoteHost implements IDenoHost {
  async getBootstrapCore(): Promise<any> {
    return this.core;
  }

  proxy: Remote<DenoHost>;

  getOpsMappings() {
    return this.proxy.getOpsMappings();
  }

  core: {
    opcallSync: (index: any, arg1: any, arg2: any) => any;
    opcallAsync: (index: any, promiseId: any, arg1: any, arg2: any) => any;
    callConsole: (oldLog: any, newLog: any, ...args: any[]) => void;
    setMacrotaskCallback: (cb: any) => void;
    setWasmStreamingCallback: (cb: any) => void;
    decode: (data: Uint8Array) => string;
    encode: (data: string) => Uint8Array;
  };

  overrideOps: Op[]

  constructor(endpoint: any) {
    this.proxy = wrap(endpoint);
    this.overrideOps = {
      "op_read": {
        async: (buffer: Uint8Array) => {
          
        }
      }
    }
    this.core = {
      opcallSync: (index, arg1, arg2) => {
        console.group('op sync', index, arg1, arg2);
        let result = sendOpCall(index, arg1, arg2);
        console.log(result);
        console.groupEnd();

        return result;
      },
      opcallAsync: async (index, promiseId, arg1, arg2): Promise<any> => {
        console.group('op async', await this.proxy.ops[index].name, arg1, arg2);
        let result = await this.proxy.core.opcallAsync(index, promiseId, arg1, arg2);
        console.log(result);
        console.groupEnd();
        return result;
      },
      callConsole: (oldLog, newLog, ...args) => {
        // if (typeof args[0] === 'string' && args[0].startsWith('op ')) {
        // if (this.ops.find((o) => o.name === args[1])) {
        //   console.log(...args);
        // } else {
        //   console.error(...args);
        // }
        // } else {
        oldLog(...args);
        // }
      },
      setMacrotaskCallback: (cb) => {
        console.log('macrostask callback');
      },
      setWasmStreamingCallback: (cb) => {
        console.log('wasm streaming callback');
      },

      decode: function (data: Uint8Array) {
        return new TextDecoder().decode(data);
      },

      encode: function (data: string) {
        return new TextEncoder().encode(data);
      },
    };
  }
}

export class DenoHost implements IDenoHost {
  async getBootstrapCore(): Promise<any> {
    return this.core;
  }

  getOpsMappings() {
    return this.ops.map((o, index) => [o.name, index]).slice(1);
  }

  getResource<T extends Resource>(arg0: number): T {
    return this.resourceTable.get(arg0) as T;
  }

  core: {
    opcallSync: (index: any, arg1: any, arg2: any) => any;
    opcallAsync: (index: any, promiseId: any, arg1: any, arg2: any) => any;
    callConsole: (oldLog: any, newLog: any, ...args: any[]) => void;
    setMacrotaskCallback: (cb: any) => void;
    setWasmStreamingCallback: (cb: any) => void;
    decode: (data: Uint8Array) => string;
    encode: (data: string) => Uint8Array;
  };

  resourceTable: ResourceTable;

  addResource(res: Resource) {
    let rid = this.nextRid++;
    this.resourceTable.set(rid, res);
    return rid;
  }
  nextRid = 0;

  constructor() {
    this.resourceTable = new Map<number, Resource>();

    this.addResource(new ConsoleLogResource());
    this.addResource(new ConsoleLogResource());
    this.addResource(new ConsoleLogResource());

    this._ops = [
      {
        name: 'INTERNAL',
        sync: () => {
          return this.getOpsMappings();
        },
        async: () => {},
      },
      {
        name: 'op_cwd',
        sync: () => {},
        async: () => {},
      },
      {
        name: 'op_read',
        sync: () => {},
        async: async (rid: number, data: Uint8Array) => {
          debugger;
          let resource = this.resourceTable.get(rid);
          return await resource.read(data);
        },
      },
      {
        name: 'op_write',
        sync: () => {},
        async: async (rid: number, data: Uint8Array) => {
          let resource = this.resourceTable.get(rid);
          return await resource.write(data);
        },
      },

      asyncOp('op_read_dir_async', async (dirPath: string) => {
        return ['hello.txt'];
      }),
      {
        name: 'op_format_file_name',
        sync: (arg) => arg,
        async: async (arg) => {
          return arg;
        },
      },
      {
        name: 'op_url_parse',
        sync: (arg) => {
          let url = new URL(arg);
          return urlToDenoUrl(url);
        },
        async: async (arg) => {
          return arg;
        },
      },
      {
        name: 'op_url_reparse',
        sync: (arg, value) => {
          const SET_HASH = 1;
          const SET_HOST = 2;
          const SET_HOSTNAME = 3;
          const SET_PASSWORD = 4;
          const SET_PATHNAME = 5;
          const SET_PORT = 6;
          const SET_PROTOCOL = 7;
          const SET_SEARCH = 8;
          const SET_USERNAME = 9;

          let url = new URL(arg);
          switch (arg) {
            case SET_HASH:
              url.hash = value;
              break;
            case SET_HOST:
              url.host = value;
              break;
            case SET_HOSTNAME:
              url.hostname = value;
              break;
            case SET_PASSWORD:
              url.password = value;
              break;
            case SET_PATHNAME:
              url.pathname = value;
              break;
            case SET_PORT:
              url.port = value;
              break;
            case SET_PROTOCOL:
              url.protocol = value;
              break;
            case SET_SEARCH:
              url.search = value;
              break;
            case SET_USERNAME:
              url.username = value;
              break;
          }

          return urlToDenoUrl(url);
        },
      },
      {
        name: 'op_fetch',
        sync: (arg) => {
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
        async: async (rid) => {
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

      {
        name: 'op_encoding_normalize_label',
        sync: (arg) => arg,
      },
      {
        name: 'op_encoding_new_decoder',
        sync: ({ label }) => {
          return this.addResource(new TextDecoderResource());
        },
      },
      {
        name: 'op_encoding_decode',
        sync: (data, { rid }) => {
          let res = this.resourceTable.get(rid) as TextDecoderResource;
          return res.decode(data);
        },
      },
      {
        name: 'op_close',
        sync: (rid) => {
          console.log('closing', rid);
          let resource = this.resourceTable.get(rid);
          resource.close();
          this.resourceTable.delete(rid);
        },
      },
      {
        name: 'op_try_close',
        sync: (rid) => {
          console.log('try closing', rid);
          let resource = this.resourceTable.get(rid);
          try {
            resource.close();
            this.resourceTable.delete(rid);
          } catch (e) {
            console.log('couldnt close', rid, resource);
          }
        },
      },
      {
        name: 'op_open_async',
        async: async (arg) => {
          let file = kernel.fs.openSync(arg.path, constants.fs.O_RDWR, arg.mode);
          console.log(file);
          return this.addResource(new FileResource(file, arg.path));
        },
      },

      asyncOp('op_fstat_async', async (rid) => {
        let file = this.resourceTable.get(rid) as FileResource;
        let stat = file.file.statSync();
        return {
          size: stat.size,
          isFile: true,
          isDirectory: false,
          isSymbolicLink: false,
        };
      }),
    ];

    network(this);

    this.core = {
      opcallSync: (index, arg1, arg2) => {
        // this is called when Deno.core.syncOpsCache is run
        // we have to reply with an array of [op_name, id in op_cache]]
        // Deno maintains a cache of this mapping
        // so it can call ops by passing a number, not the whole string
        if (index === 0) {
          return this.getOpsMappings();
        }

        if (!this.ops[index]) {
          throw new Error(`op ${index} not found`);
        } else if (!this.ops[index].sync) {
          throw new Error(`op ${index} not sync`);
        }

        // @ts-ignore
        let opResult = this.ops[index].sync(arg1, arg2);
        console.log('opcall sync', this.ops[index].name, opResult);

        return opResult;
      },
      opcallAsync: (index, promiseId, arg1, arg2): Promise<any> => {
        return this.ops[index].async(arg1, arg2);
      },
      callConsole: (oldLog, newLog, ...args) => {
        if (typeof args[0] === 'string' && args[0].startsWith('op ')) {
          if (this.ops.find((o) => o.name === args[1])) {
            console.log(...args);
          } else {
            console.error(...args);
          }
        } else {
          oldLog(...args);
        }
      },
      setMacrotaskCallback: (cb) => {
        console.log('macrostask callback');
      },
      setWasmStreamingCallback: (cb) => {
        console.log('wasm streaming callback');
      },

      decode: function (data: Uint8Array) {
        return new TextDecoder().decode(data);
      },

      encode: function (data: string) {
        return new TextEncoder().encode(data);
      },
    };
  }

  _ops: Op[];

  get ops() {
    return this._ops;
  }
}

function urlToDenoUrl(url: URL) {
  return [
    url.href,
    url.hash,
    url.host,
    url.hostname,
    url.origin,
    url.password,
    url.pathname,
    url.port,
    url.protocol,
    url.search,
    url.username,
  ].join('\n');
}

function network(kernel: DenoHost) {
  kernel._ops.push(
    syncOp('op_net_listen', (args): OpConn => {
      switch (args.transport) {
        case 'tcp': {
          console.log('tcp listener', args);

          let socket = new Socket();

          // socket.bind({
          //   hostname: args.hostname,
          //   port: args.port,
          // });

          let listenerRid = kernel.addResource(new TcpListenerResource(socket));

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
    asyncOp('op_net_accept', async (args): Promise<OpConn> => {
      console.log('tcp accept', args);

      let listener = kernel.getResource<TcpListenerResource>(args.rid);

      let tcpStream = await listener.socket.accept();

      let streamRid = kernel.addResource(new TcpStreamResource(tcpStream));
      return {
        rid: streamRid,
        localAddr: tcpStream.localAddr,
        remoteAddr: tcpStream.peerAddr,
      };
    }),
    asyncOp('op_net_connect', async (args): Promise<OpConn> => {
      switch (args.transport) {
        case 'tcp': {
          console.log('tcp listener', args);

          let socket = new Socket();
          let listenerRid = kernel.addResource(new TcpListenerResource(socket));

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
  );
}

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

export interface IDenoHost {
  getBootstrapCore(): any;
}

enum AddrType {
  Tcp,
  Udp,
  Unix,
  UnixPacket,
}

function op(
  name: string,
  execute: {
    async: Function;
    sync: Function;
  },
): Op {
  return {
    name,
    ...execute,
  };
}
function asyncOp(name: string, execute: Function): Op {
  return {
    name,
    async: execute,
    sync: execute,
  };
}
function syncOp(name: string, execute: Function): Op {
  return {
    name,
    sync: execute,
    async: execute,
  };
}
type Op = {
  name: string;
  sync?: Function;
  async?: Function;
};

class ConsoleLogResource extends Resource {
  name = 'console';
  async read(data: Uint8Array) {
    return 0;
  }
  async write(data: Uint8Array) {
    let str = new TextDecoder().decode(data);
    // console.log(str);
    console.log(str);
    return data.length;
  }
  close() {
    //
  }
  shutdown() {
    return Promise.resolve();
  }
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

class TextDecoderResource extends Resource {
  decoder = new TextDecoder();

  close() {}

  decode(data: Uint8Array) {
    return this.decoder.decode(data);
  }
}

class FileResource extends Resource {
  constructor(public file: File, public name: string) {
    super();
  }

  position = 0;
  async read(data: Uint8Array) {
    if (this.position >= this.file.statSync().size) {
      return null;
    }
    let container = Buffer.from(data);
    let nread = this.file.readSync(
      container,
      0,
      Math.min(this.file.statSync().size, data.byteLength),
      0,
    );

    data.set(container, 0);

    this.position += nread;

    return nread;
  }

  async write(data: Uint8Array) {
    let container = Buffer.from(data);
    let nwritten = this.file.writeSync(
      container,
      0,
      Math.max(this.file.statSync().size, data.byteLength),
      0,
    );

    this.position += nwritten;

    return nwritten;
  }

  close() {
    this.file.closeSync();
  }
}
