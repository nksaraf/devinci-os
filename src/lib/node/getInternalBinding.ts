import { constants } from './constants';
import type { InternalAsyncWrapBinding } from './internalBinding/async_wrap';
export const getInternalBinding = (name) =>
  ({
    constants,
    async_wrap: {
      constants: {
        kInit: 0,
        kBefore: 1,
        kAfter: 2,
        kDestroy: 3,
        kPromiseResolve: 4,
        kTotals: 5,
        kCheck: 6,
        kStackLength: 7,
        kUsesExecutionAsyncResource: 8,

        kExecutionAsyncId: 0,
        kTriggerAsyncId: 1,
        kAsyncIdCounter: 2,
        kDefaultTriggerAsyncId: 3,
      },
      setCallbackTrampoline(
        callback: (
          asyncId: number,
          resource: InternalAsyncWrapBinding.Resource,
          cb: (cb: (...args: any[]) => boolean | undefined, ...args: any[]) => boolean | undefined,
          ...args: any[]
        ) => boolean | undefined,
      ): void {
        
      },
    },
    blob: {},
    block_list: {},
    buffer: {},
    cares_wrap: {},
    config: {
      isDebugBuild: false,
      hasOpenSSL: false,
      fipsMode: false,
      hasIntl: false,
      hasTracing: false,
      hasNodeOptions: false,
      hasInspector: false,
      noBrowserGlobals: false,
      bits: false,
      hasDtrace: false,
    },
    contextify: {},
    credentials: {},
    errors: {},
    fs: {},
    fs_dir: {},
    fs_event_wrap: {},
    heap_utils: {},
    http2: {},
    http_parser: {},
    inspector: {},
    js_stream: {},
    js_udp_wrap: {},
    messaging: {},
    module_wrap: {},
    native_module: {
      moduleIds: [],
      compileFunction: () => {
        throw new Error('Not implemented');
      },
    },
    options: {},
    os: {},
    performance: {},
    pipe_wrap: {},
    process_wrap: {},
    process_methods: {},
    report: {},
    serdes: {},
    signal_wrap: {},
    spawn_sync: {},
    stream_pipe: {},
    stream_wrap: {},
    string_decoder: {},
    symbols: {},
    task_queue: {},
    tcp_wrap: {},
    timers: {},
    trace_events: {},
    tty_wrap: {},
    types: {
      isNativeError: (value: unknown) => {
        return value instanceof Error;
      },
    },
    udp_wrap: {},
    url: {
      setURLConstructor: () => {},
    },
    util: {
      getPromiseDetails: (x: Promise<any>) => x && x.toString(),
      getProxyDetails: (x: Promise<any>) => x && x.toString(),
      isAnyArrayBuffer: (x: any) => x instanceof ArrayBuffer,
      isUint8Array: (x: any) => x instanceof Uint8Array,
      isDataView: (x: any) => x instanceof DataView,
      isExternal: (x: any) => false,
      isMap: (x: any) => x instanceof Map,
      isMapIterator: (x: any) => (x || {}).constructor === new Map().entries().constructor,
      isPromise: (x: any) => x instanceof Promise,
      isSet: (x: any) => x instanceof Set,
      isSetIterator: (x: any) => (x || {}).constructor === new Set().entries().constructor,
      isTypedArray: (x: any) =>
        x instanceof Int8Array ||
        x instanceof Uint8Array ||
        x instanceof Uint8ClampedArray ||
        x instanceof Int16Array ||
        x instanceof Uint16Array ||
        x instanceof Int32Array ||
        x instanceof Uint32Array ||
        x instanceof Float32Array ||
        x instanceof Float64Array,
      isRegExp: (x: any) => x instanceof RegExp,
      isDate: (x: any) => x instanceof Date,
      // kPending,
      // kRejected,
      startSigintWatchdog: () => {},
      stopSigintWatchdog: () => {},
      getHiddenValue: (error: any, noIdea: any): boolean => false,
      createPromise: () => {
        console.error('util.createPromise not implemented');
      },
      promiseReject: () => {
        console.error('util.promiseReject not implemented');
      },
      promiseResolve: () => {
        console.error('util.promiseResolve not implemented');
      },

      propertyFilter: {
        ALL_PROPERTIES: 0,
        ONLY_WRITABLE: 1,
        ONLY_ENUMERABLE: 2,
        ONLY_CONFIGURABLE: 4,
        SKIP_STRINGS: 8,
        SKIP_SYMBOLS: 16,
      },
    },
    uv: {},
    v8: {},
    wasi: {},
    worker: {},
    watchdog: {},
  }[name]);
