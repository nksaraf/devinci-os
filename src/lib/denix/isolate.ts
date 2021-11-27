import { ApiError, ErrorCodeToName, ERROR_KIND_TO_CODE } from '../error';
import type { Kernel } from './denix';
import { loadDenoRuntime } from './runtime';

export type Context = typeof globalThis;

let ISOLATE_ID = 0;

interface IDenoCore {
  opcallSync: any;
  opcallAsync: (op_code: number, promiseId: number, arg1: any, arg2: any) => void;
  callConsole: (oldLog: any, newLog: any, ...args: any[]) => void;
  setMacrotaskCallback: (cb: any) => void;
  setWasmStreamingCallback: (cb: any) => void;
  decode: (data: Uint8Array) => string;
  encode: (data: string) => Uint8Array;
  isProxy: (v: any) => boolean;
  getProxyDetails: (v: any) => any;
  opresolve?(...args): void;
  syncOpsCache?(): void;
}

export class DenoIsolate extends EventTarget {
  id: number;
  kernel: Kernel;
  core: IDenoCore;

  wasmStreamingCallback;
  Deno: typeof Deno;
  onConnect: any;

  constructor({ onConnect = async (port: MessagePort) => {} } = {}) {
    super();
    this.onConnect = onConnect;

    this.core = {
      opcallSync: this.opcallSync.bind(this),
      opcallAsync: this.opcallAsync.bind(this),
      callConsole: (oldLog, newLog, ...args) => {
        console.log(...args);

        if (args[0].startsWith('op sync') || args[0].startsWith('op async')) {
          return;
        }

        this.kernel.dispatchEvent(new CustomEvent('console', { detail: args.toString() }));
      },
      setMacrotaskCallback: (cb) => {
        console.log('macrostask callback');
      },
      setWasmStreamingCallback: (cb) => {
        this.wasmStreamingCallback = cb;
      },
      decode: function (data: Uint8Array) {
        console.log(data);
        return new TextDecoder().decode(new Uint8Array(data));
      },
      encode: function (data: string) {
        return new TextEncoder().encode(data);
      },
      isProxy: function (obj) {
        return false;
      },
      getProxyDetails: function (obj) {
        return null;
      },
    };

    this.id = ISOLATE_ID++;
  }

  public context: Context;

  opcallSync(op_code: number, arg1: any, arg2: any) {
    return this.kernel.opSync(op_code, arg1, arg2);
  }

  opcallAsync(...args: Parameters<Kernel['opAsync']>) {
    this.kernel.opAsync(...args).then((value) => {
      this.core.opresolve(args[1], value);
    });
  }

  async attach(kernel: Kernel) {
    this.kernel = kernel;

    let context = await loadDenoRuntime(this.core, kernel.fs);

    this.context = context;

    this.core.syncOpsCache();

    await context.bootstrap.mainRuntime({
      target: 'aarch64-devinci-darwin-dev',
      debugFlag: true,
      noColor: false,
      unstableFlag: true,
      args: [],
      // location: window.location.href,
      // ...options,
    });

    this.Deno = this.context.Deno;

    this.Deno.core.registerErrorClass('ApiError', ApiError);

    Object.assign(this.context, {
      WebAssembly: {
        compileStreaming: async (source) => {
          let res = await source;
          return await WebAssembly.compileStreaming(fetch(res.url));
        },
        Instance: WebAssembly.Instance,
        instantiate: WebAssembly.instantiate,
        instantiateStreaming: WebAssembly.instantiateStreaming,
        compile: WebAssembly.compile,
      },
    });
  }

  async connectRemote(port: MessagePort) {
    await this.onConnect(port);
  }

  async eval(source: string, options: {} = {}) {
    throw new Error('Not implemented');
    // return await this.linker.eval(source, this.context);
  }

  async run(
    path: string,
    options: {
      args?: string[];
    } = {},
  ) {
    if (path.endsWith('.wasm')) {
      return await this.runWASM(path, options);
    }

    await new Function(`return async () => {
      return await import("${path}?script")
    }`)()();

    return;
  }

  async runWASM(path: string, options: { args?: string[] }) {
    const { default: Context } = await import(
      'https://deno.land/std@0.115.1/wasi/snapshot_preview1.ts'
    );

    const context = new Context({
      args: [path, ...(options.args ?? [])],
      env: Deno.env.toObject(),
      exitOnReturn: false,
      preopens: {
        '/lib': '/lib',
        '/lib/deno': '/lib/deno',
      },
    });

    const wasm = await WebAssembly.compileStreaming(fetch(path));

    let instance = await WebAssembly.instantiate(wasm, {
      wasi_snapshot_preview1: context.exports,
      wasi_unstable: context.exports,
    });

    await context.start(instance);
    return;
  }
}
