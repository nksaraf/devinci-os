import { ApiError } from '../error';
import type { Process } from '../denix/denix';
import { loadDenoRuntime } from './runtime';
import type { ResourceTable } from '../denix/types';
import { join } from 'path-browserify';

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

// This is an isolated Deno environment. It needs to be connected to a process
// for its ops to be available. This loads the Deno runtime and sets it up using the
// provided process. this is the public API available to the user, not the process itself
export class DenoIsolate extends EventTarget {
  id: number;
  process: Process;
  core: IDenoCore;

  wasmStreamingCallback;

  Deno: typeof Deno;
  onConnect: any;

  constructor({} = {}) {
    super();

    this.core = {
      opcallSync: this.opcallSync.bind(this),
      opcallAsync: this.opcallAsync.bind(this),
      callConsole: (oldLog, newLog, ...args) => {
        oldLog(...args);

        if (
          typeof args[0] === 'string' &&
          (args[0].startsWith('op sync') || args[0].startsWith('op async'))
        ) {
          return;
        }

        newLog(...args);

        this.process.dispatchEvent(new CustomEvent('console', { detail: args.toString() }));
      },
      setMacrotaskCallback: (cb) => {
        console.log('macrostask callback');
      },
      setWasmStreamingCallback: (cb) => {
        // we dont do anything with this callback right now
        // we override the default implementation in the runtime of compileStreaming
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

  public window: Context;

  opcallSync(op_code: number, arg1: any, arg2: any) {
    return this.process.opSync(op_code, arg1, arg2);
  }

  opcallAsync(...args: Parameters<Process['opAsync']>) {
    this.process.opAsync(...args).then((value) => {
      this.core.opresolve(args[1], value);
    });
  }

  async attach(kernel: Process) {
    this.process = kernel;

    let context = await loadDenoRuntime(this.core, kernel.fs);

    this.window = context;

    this.core.syncOpsCache();

    await context.bootstrap.mainRuntime({
      target: 'aarch64-devinci-darwin-dev',
      debugFlag: true,
      noColor: false,
      unstableFlag: true,
      args: kernel.cmd,
      // location: window.location.href,
      // ...options,
    });

    this.Deno = this.window.Deno;

    // @ts-ignore
    this.Deno.core.registerErrorClass('ApiError', ApiError);

    Object.assign(this.window, {
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

  async connectRemote(port: MessagePort, resourceTable: ResourceTable) {
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
      mode?: 'script' | 'module';
    } = {
      mode: 'script',
    },
  ) {
    if (path.endsWith('.wasm')) {
      return await this.runWASM(path, options);
    }

    if (path.startsWith('.')) {
      console.log(path);
      path = new URL(join('/_', this.process.cwd, path), new URL(import.meta.url).origin).href;
      console.log(path);
    }

    if (options.mode === 'script') {
      let result = await new Function(`return async (context) => {
        with (context) {
          return await import("${path}?script")
        }
      }`)()(this.window);

      return result;
    } else {
      let result = await new Function(`return async () => {
        const { main } = await import("${path}")
        console.log(main);
        return await main(${JSON.stringify(options.args)})
      }`)()();

      return result;
    }
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
