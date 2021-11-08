import toExport from '../global';
import { constants } from './constants';
import type { InternalAsyncWrapBinding } from './bindings/async_wrap';
import * as fs from './bindings/fs';
import type { Kernel } from './runtime';

class FSEvent {}

export const createInternalBindings = (kernel: Kernel) => (name) =>
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
      ): void {},
      setupHooks() {},
    },
    blob: {},
    block_list: {},
    buffer: {
      setBufferPrototype(proto): void {
        toExport.Buffer.prototype = proto;
      },
      getZeroFillToggle() {
        return true;
      },
    },
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
    errors: {
      setPrepareStackTraceCallback(
        prepareStackTrace: (
          error: Error,
          structuredStackTrace: NodeJS.CallSite[],
        ) => NodeJS.CallSite[],
      ): void {},
      setEnhanceStackForFatalException(
        enhanceStackForFatalException: (error: Error, message: string) => string,
      ): void {},
    },
    fs: fs,
    fs_dir: {},
    fs_event_wrap: {
      FSEvent,
    },
    heap_utils: {},
    http2: {},
    http_parser: {},
    inspector: {},
    js_stream: {},
    js_udp_wrap: {},
    messaging: {
      setDeserializerCreateObjectFunction: (
        createObjectFunction: (data: Buffer, type: string, subtype: string) => any,
      ): void => {},
      MessagePort,
      JSTransferable: class JSTrasnferable {},
    },
    module_wrap: {},
    native_module: {
      moduleIds: [],
      compileFunction: () => {
        throw new Error('Not implemented');
      },
      config: '{}',
    },
    options: {},
    os: {},
    performance: {
      getTimeOrigin: () => 0,
      getTimeOriginTimestamp: () => 0,
      constants: {
        NODE_PERFORMANCE_ENTRY_TYPE_GC: 0,
        NODE_PERFORMANCE_ENTRY_TYPE_HTTP2: 1,
        NODE_PERFORMANCE_ENTRY_TYPE_HTTP: 2,
      },
      setupObservers() {},
    },
    pipe_wrap: {},
    process_wrap: {},
    process_methods: {},
    report: {},
    serdes: {},
    signal_wrap: {},
    spawn_sync: {},
    stream_pipe: {},
    stream_wrap: {},
    string_decoder: {
      encodings: [],
    },
    symbols: {
      handle_onclose: Symbol('handle_onclose'),
      messaging_deserialize_symbol: Symbol('messaging_deserialize_symbol'),
      messaging_transfer_symbol: Symbol('messaging_transfer_symbol'),
      messaging_clone_symbol: Symbol('messaging_clone_symbol'),
      messaging_transfer_list_symbol: Symbol('messaging_transfer_list_symbol'),
    },
    task_queue: {
      tickInfo: {},
      promiseRejectEvents: {
        kPromiseRejectWithNoHandler: Symbol('kPromiseRejectWithNoHandler'),
        kPromiseHandlerAddedAfterReject: Symbol('kPromiseHandlerAddedAfterReject'),
        kPromiseResolveAfterResolved: Symbol('kPromiseResolveAfterResolved'),
        kPromiseRejectAfterResolved: Symbol('kPromiseRejectAfterResolved'),
      },
      setPromiseRejectCallback: (
        callback: (promise: Promise<any>, reason: any) => void,
      ): void => {},
      setTickCallback(callback: (...args: any[]) => void): void {},
    },
    tcp_wrap: {},
    timers: {
      setupTimers() {},
    },
    trace_events: {
      setTraceCategoryStateUpdateHandler(
        callback: (categoryGroupEnabled: string, state: number) => void,
      ): void {},
    },
    tty_wrap: {},
    types: {
      isNativeError: (value: unknown) => value instanceof Error,
      isSet: (x: any) => x instanceof Set,
      isWeakSet: (x: any) => x instanceof WeakSet,
      isAnyArrayBuffer: (x: any) => x instanceof ArrayBuffer,
      isUint8Array: (x: any) => x instanceof Uint8Array,
      isDataView: (x: any) => x instanceof DataView,
      isExternal: (x: any) => false,
      isMap: (x: any) => x instanceof Map,
      isWeakMap: (x: any) => x instanceof WeakMap,
      isMapIterator: (x: any) => (x || {}).constructor === new Map().entries().constructor,
      isPromise: (x: any) => x instanceof Promise,
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
      isModuleNamespaceObject: (x: any) => false,
      isBoxedPrimitive: (x: any) => false,
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
      getConstructorName: (x: any) => x && x.constructor && x.constructor.name,
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
