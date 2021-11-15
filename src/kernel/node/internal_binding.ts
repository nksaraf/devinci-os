import Global from '../global';
import { constants } from '../kernel/constants';
import hrtime from '../wasi/polyfills/browser-hrtime';
import type { InternalAsyncWrapBinding } from './bindings/async_wrap';
import { fsBinding } from './bindings/fs';
import type { NodeHost } from './runtime';
import * as Base64 from './base64';
import process from './process';
class FSEvent {}

const internalBindingProxy = (iname: string, target) => {
  if (!target) {
    throw new Error(`Internal binding "${iname}" not found`);
  }
  return new Proxy(target, {
    get: (target, name) => {
      if (name in target) {
        // console.log('accessed', name, iname + ' in internal binding');
        return target[name];
      } else {
        // console.log('api not available ' + name.toString() + ' in ' + iname + '');
        return new Proxy(
          {},
          {
            get: (target, name) => {
              throw new Error(name.toString() + ' Not implemented');
            },
          },
        );
      }
    },
  });
};

function uint6ToB64(nUint6) {
  return nUint6 < 26
    ? nUint6 + 65
    : nUint6 < 52
    ? nUint6 + 71
    : nUint6 < 62
    ? nUint6 - 4
    : nUint6 === 62
    ? 43
    : nUint6 === 63
    ? 47
    : 65;
}

function base64EncArr(aBytes, length) {
  var nMod3 = 2,
    sB64Enc = '';

  for (var nLen = length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
    nMod3 = nIdx % 3;
    // if (nIdx > 0 && ((nIdx * 4) / 3) % 76 === 0) {
    //   sB64Enc += '\r\n';
    // }
    nUint24 |= aBytes[nIdx] << ((16 >>> nMod3) & 24);
    if (nMod3 === 2 || length - nIdx === 1) {
      sB64Enc += String.fromCharCode(
        uint6ToB64((nUint24 >>> 18) & 63),
        uint6ToB64((nUint24 >>> 12) & 63),
        uint6ToB64((nUint24 >>> 6) & 63),
        uint6ToB64(nUint24 & 63),
      );
      nUint24 = 0;
    }
  }

  return (
    sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) + (nMod3 === 2 ? '' : nMod3 === 1 ? '=' : '==')
  );
}

class ExternalObj {}
class Context {}
const kPrivateContext = Symbol('private_context');
const contextify = {
  ContextifyScript: class ContextifyScript {
    constructor(
      private code,
      private filename,
      private lineOffset,
      private columnOffset,
      private cachedData,
      private produceCachedData,
      private parsingContext,
    ) {}
    runInContext(ctx, timeout, displayErrors, breakOnSigint, breakFirstLine) {
      console.log(arguments);
      const global = new Proxy(ctx, {
        has: (target, name) => ctx[target],
        get: (target, name) => {
          console.log(name);
          return ctx[target];
        },
        set: (target, name, value) => {
          ctx[target] = value;
          return true;
        },
      });

      const evalWithContext = Function(`
      return (global) => {
          try {
              with (global) {
                return (${this.code})
              }
          }  catch(e) {
            throw e;
          } finally {
            
          }
      }
    `)();

      return evalWithContext(ctx);
    }
  },
  isContext: (obj: any) => kPrivateContext in obj,
  makeContext: (obj, options) => {
    obj[kPrivateContext] = true;
  },
  constants: {
    measureMemory: {
      mode: {
        SUMMARY: '',
        DETAILED: '',
      },
      execution: {},
    },
  },
};

let timerRef = false;
const timers = {
  setupTimers() {},
  toggleTimerRef(ref) {
    timerRef = ref;
  },
  getLibuvNow() {
    return performance.now();
  },
  scheduleTimer(msecs, cb) {
    setTimeout(cb, msecs);
  },
};

enum ResourceLimits {
  kMaxYoungGenerationSizeMb,
  kMaxOldGenerationSizeMb,
  kCodeRangeSizeMb,
  kStackSizeMb,
  kTotalResourceLimitCount,
}

const newLocal = {
  isMainThread: false,
  kTotalResourceLimitCount: 4,
  kMaxYoungGenerationSizeMb: ResourceLimits.kMaxYoungGenerationSizeMb,
  kMaxOldGenerationSizeMb: ResourceLimits.kMaxOldGenerationSizeMb,
  kCodeRangeSizeMb: ResourceLimits.kCodeRangeSizeMb,
  kStackSizeMb: ResourceLimits.kStackSizeMb,
  resourceLimits: new Float64Array(ResourceLimits.kTotalResourceLimitCount),
};
export const createInternalBindings = (host: NodeHost) => {
  let servers: {} = {};
  let Buffer = class {};

  return (name) => {
    return internalBindingProxy(
      name,
      {
        constants,
        crypto: {
          createNativeKeyObjectClass: (creator) => {
            return creator(class NativeKeyObject {});
          },
          kKeyTypeSecret: 0,
          kKeyTypePublic: 1,
          kKeyTypePrivate: 2,
          kKeyFormatPEM: 3,
          kKeyFormatDER: 4,
          kKeyFormatJWK: 5,
          kKeyEncodingPKCS1: 6,
          kKeyEncodingPKCS8: 7,
          kKeyEncodingSPKI: 8,
          kKeyEncodingSEC1: 9,
          getFipsCrypto: () => {},
          setFipsCrypto: (val) => {},
          timingSafeEqual: () => {},
        },
        async_wrap,
        blob: {},
        block_list: {},
        buffer: {
          setBufferPrototype(proto): void {
            Object.assign(Buffer.prototype, proto);
          },
          getZeroFillToggle() {
            return true;
          },
          compare(a, b) {
            if (!a.byteLength === b.byteLength) {
              return a.byteLength - b.byteLength;
            }

            for (let i = 0; i < a.byteLength; i++) {
              if (a[i] !== b[i]) {
                return a[i] - b[i];
              }
            }

            return 0;
          },
          byteLengthUtf8(buf: string): number {
            return new TextEncoder().encode(buf).byteLength;
          },
          utf8Write(this: ArrayBuffer, text: string, offset: number, length: number): number {
            const u8 = new TextEncoder().encode(text);
            for (var i = 0; i < u8.length; i++) {
              this[offset + i] = u8[i];
            }
            return u8.length;
          },
          fill(
            buf: ArrayBuffer,
            value: string,
            offset: number,
            end: number,
            encoding: string,
          ): number {
            const u8 = new TextEncoder().encode(value);
            for (var i = 0; i < end; i++) {
              buf[offset + i] = u8[i % u8.length];
            }

            return end;
          },
          hexWrite(this: ArrayBuffer, text: string, offset: number, length: number): number {
            const u8 = new TextEncoder().encode(text);
            for (var i = 0; i < u8.length; i++) {
              this[offset + i] = u8[i];
            }
            return u8.length;
          },
          utf8Slice(this: ArrayBuffer, offset: number, length: number): string {
            console.log('utf8Slice', this, length);
            var buf = new Uint8Array(length - offset);
            for (var i = offset; i < length; i++) {
              buf[i - offset] = this[i];
            }
            return new TextDecoder('utf-8').decode(buf);
          },
          asciiSlice(this: ArrayBuffer, offset: number, length: number): string {
            console.log('utf8Slice', this, length);
            var buf = new Uint8Array(length - offset);
            for (var i = offset; i < length; i++) {
              buf[i - offset] = this[i];
            }
            return new TextDecoder('ascii').decode(buf);
          },
          latin1Slice(this: ArrayBuffer, offset: number, length: number): string {
            console.log('utf8Slice', this, length);
            var buf = new Uint8Array(length - offset);
            for (var i = offset; i < length; i++) {
              buf[i - offset] = this[i];
            }
            return new TextDecoder('latin1').decode(buf);
          },
          createFromString(str: string, encoding: string): Uint8Array {
            console.log(str, encoding);
            return new Uint8Array(0);
          },
          base64Slice(this: ArrayBuffer, offset: number, length: number): string {
            return base64EncArr(this, length);
          },
          base64Write(this: ArrayBuffer, text: string, offset: number, length: number): number {
            let array = Base64.toUint8Array(text);
            let written = array.byteLength;
            for (var i = 0; i < written; i++) {
              this[offset + i] = array[i];
            }
            return written;
          },
          base64urlWrite(this: ArrayBuffer, text: string, offset: number, length: number): number {
            let array = Base64.toUint8Array(text);
            let written = array.byteLength;
            for (var i = 0; i < written; i++) {
              this[offset + i] = array[i];
            }
            return written;
          },
          base64urlSlice(this: ArrayBuffer, offset: number, length: number): string {
            return base64EncArr(this, length)
              .replace(/(=+)$/g, '')
              .replace(/\+/g, '-')
              .replace(/\//g, '_');
          },
          asciiWrite(this: ArrayBuffer, text: string, offset: number, length: number): number {
            for (var i = 0; i < text.length; i++) {
              this[offset + i] = text.charCodeAt(i);
            }
            return text.length;
          },
          latin1Write(this: ArrayBuffer, text: string, offset: number, length: number): number {
            for (var i = 0; i < text.length; i++) {
              this[offset + i] = text.charCodeAt(i);
            }
            return text.length;
          },
          // max length for buffer, default from NodeJS
          // number takenn from node REPL
          kMaxLength: 4294967295,
          // max string length, default from NodeJS
          // number takenn from node REPL
          kStringMaxLength: 536870888,
        },
        cares_wrap: {
          ChannelWrap: class ChannelWrap {
            private _servers: any[] = [];
            constructor(private _timeout: number, private _tries: number) {}

            getServers() {
              return this._servers;
            }

            setServers(servers) {
              this._servers = servers;
            }
          },
          GetAddrInfoReqWrap: class {
            callback: (err: Error | null, res: any) => void;
            family: number;
            hostname: string;
            oncomplete;
          },

          getaddrinfo(req, hostname, family, hints, verbatim) {
            console.log('getaddrinfo', hostname, family, hints, verbatim);
            req.oncomplete.bind(req)(0, ['127.0.0.1']);
          },
        },
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
          variables: {
            clang: 0,
            host_arch: 'x32',
            node_install_npm: false,
            node_install_waf: false,
            node_prefix: '',
            node_shared_cares: false,
            node_shared_http_parser: false,
            node_shared_libuv: false,
            node_shared_zlib: false,
            node_shared_v8: false,
            node_use_dtrace: false,
            node_use_etw: false,
            node_use_openssl: false,
            node_shared_openssl: false,
            strict_aliasing: false,
            target_arch: 'x32',
            v8_use_snapshot: false,
            v8_no_strict_aliasing: 0,
            v8_enable_i18n_support: false,
            visibility: '',
          },
        },
        contextify: contextify,
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
        fs: fsBinding(host.kernel),
        fs_dir: {},
        fs_event_wrap: {
          FSEvent,
        },
        heap_utils: {},
        http2: {},
        http_parser: {
          methods: ['get', 'post', 'head', 'connect', 'put', 'delete'],
          HTTPParser: class HTTPParser {
            static kOnMessageBegin = 0;
            initialize(type, resource, maxHeaderSize, linient, headersTimeout) {}
          },
        },
        inspector: {},
        js_stream: {
          JSStream: class JSStream {
            _externalStream = new ExternalObj();
          },
        },
        js_udp_wrap: {},
        messaging: {
          setDeserializerCreateObjectFunction: (
            createObjectFunction: (data: Buffer, type: string, subtype: string) => any,
          ): void => {},
          MessagePort,
          MessageChannel,
          JSTransferable: class JSTrasnferable {},
        },
        module_wrap: {},
        native_module: {
          moduleIds: [],
          compileFunction: () => {
            throw new Error('Not implemented');
          },
          config: JSON.stringify(process.config),
        },
        options: {
          getCLIOptions: () => {
            let options = new Map();
            options.set('--conditions', { value: [] });
            return { options };
          },
        },
        os: {
          getOSInformation: () => ['darwin', '1.0', '1.0'],
          getFreeMem: () => 1000,
          getHostname: () => 1000,
          getTotalMem: () => 1000,
          getUptime: () => 1000,
          getHomeDirectory: () => 1000,
        },
        performance: {
          getTimeOrigin: () => 0,
          getTimeOriginTimestamp: () => 0,
          constants: {
            NODE_PERFORMANCE_ENTRY_TYPE_GC: 0,
            NODE_PERFORMANCE_ENTRY_TYPE_HTTP2: 1,
            NODE_PERFORMANCE_ENTRY_TYPE_HTTP: 2,
          },
          loopIdleTime: () => 0,
          setupObservers() {},
        },

        process_wrap: {
          Process: class Process {
            spawn(options) {
              console.log('spawn', options);
            }
          },
        },
        process_methods: {
          patchProcessObject(proc) {},
          getFastAPIs() {
            return { hrtime };
          },
        },
        report: {
          shouldReportOnSignal: () => false,
        },
        serdes: {},
        signal_wrap: {},
        spawn_sync: {
          spawn: (options) => {
            console.log('spawn sync', options);
            return {
              output: [undefined, '', ''],
              status: 0,
            };
          },
        },
        stream_pipe: {},
        stream_wrap: {},
        string_decoder: {
          encodings: ['utf8', 'ascii', 'base64', 'base64url', 'latin1'],
        },
        symbols: {
          handle_onclose: Symbol('handle_onclose'),
          messaging_deserialize_symbol: Symbol('messaging_deserialize_symbol'),
          messaging_transfer_symbol: Symbol('messaging_transfer_symbol'),
          messaging_clone_symbol: Symbol('messaging_clone_symbol'),
          messaging_transfer_list_symbol: Symbol('messaging_transfer_list_symbol'),
          owner_symbol: Symbol('owner_symbol'),
          async_id_symbol: Symbol('async_id_symbol'),
          trigger_async_id_symbol: Symbol('trigger_async_id_symbol'),
          oninit: Symbol('oninit'),
          no_message_symbol: Symbol('oninit'),
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
          setTickCallback(callback: (...args: any[]) => void): void {
            setInterval(callback, 1000);
          },

          runMicrotasks() {
            console.log('runinning micro tasks');
          },
        },
        pipe_wrap: {
          Pipe: class Pipe {
            connect(req: PipeConnectWrap, address: string, onConnect: Function) {
              console.log('connect', req, address, onConnect);
            }
          },
          PipeConnectWrap: class PipeConnectWrap {
            oncomplete: Function;
            address: string;
          },
          constants: {
            SOCKET: 1,
            IPC: 2,
          },
        },
        tcp_wrap: {
          TCPConnectWrap: class TCPConnectWrap {
            oncomplete: Function;
            address: string;
            port: number;
            localAddress: string;
            localPort: number;
          },
          TCP: class TCP {
            constructor(public mode, options) {}
            isListening = false;
            bind6(address, port, flags): Error {
              console.log('bind6', address, port);
              if (servers[port]) {
                return new Error('Address already in use');
              }

              servers[port] = this;
              return;
            }
            connect(req: TCPConnectWrap, address: string, port: number) {
              console.log('connect', req, address, port);
              servers[port].onconnection(0, () => {});
              req.oncomplete.bind(req)(0, this, req, false, true);
            }
            bind(address, port): Error {
              console.log('bind', address, port);
              if (servers[port]) {
                return new Error('Address already in use');
              }

              servers[port] = this;
              return;
            }
            listen(backlog): Error {
              console.log('listen', backlog);
              this.isListening = true;
              console.log(servers);
              return;
            }
          },
          constants: {
            SERVER: 1,
          },
        },
        timers: timers,
        trace_events: {
          setTraceCategoryStateUpdateHandler(
            callback: (categoryGroupEnabled: string, state: number) => void,
          ): void {},
          isTraceCategoryEnabled(categoryGroup: string): boolean {
            return false;
          },
        },
        tty_wrap: {},
        types: {
          isNativeError: (value: unknown) => value instanceof Error,
          isSet: (x: any) => x instanceof Set,
          isWeakSet: (x: any) => x instanceof WeakSet,
          isArrayBuffer: (x: any) => x instanceof ArrayBuffer,
          isAnyArrayBuffer: (x: any) => x instanceof ArrayBuffer,
          isUint8Array: (x: any) => x instanceof Uint8Array,
          isDataView: (x: any) => x instanceof DataView,
          isExternal: (x: any) => x instanceof ExternalObj,
          isMap: (x: any) => x instanceof Map,
          isWeakMap: (x: any) => x instanceof WeakMap,
          isMapIterator: (x: any) =>
            x.__proto__?.[Symbol.toStringTag] === 'Map Iterator' &&
            (x || {}).constructor === new Map().entries().constructor &&
            !('callee' in x),
          isPromise: (x: any) => x instanceof Promise,
          isSetIterator: (x: any) =>
            x.__proto__?.[Symbol.toStringTag] === 'Set Iterator' &&
            (x || {}).constructor === new Set().entries().constructor &&
            !('callee' in x),
          isBooleanObject: (x: any) => x instanceof Boolean,
          isStringObject: (value: unknown) => value instanceof String,
          isNumberObject: (value: unknown) => value instanceof Number,
          isBigIntObject: (value: unknown) => value instanceof BigInt,
          isSymbolObject: (value: unknown) => value instanceof Symbol,
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
          isArgumentsObject: (x: any) => {
            return 'callee' in x && typeof x == 'object';
          },
          isGeneratorFunction: (x: any) =>
            typeof x === 'function' &&
            x.constructor.name === 'GeneratorFunction' &&
            x.constructor.name !== 'AsyncGeneratorFunction',
          isGeneratorObject: (x: any) =>
            x.constructor && x.constructor.constructor
              ? x.constructor.constructor.name === 'GeneratorFunction'
              : false,
          isAsyncFunction: (x: any) =>
            typeof x === 'function' &&
            x.constructor.name === 'AsyncFunction' &&
            x.constructor.name !== 'AsyncGeneratorFunction',
        },
        udp_wrap: {
          constants: {},
          UDP: class UDP {},
          SendSync: class SendSync {},
        },
        url: {
          setURLConstructor: () => {},
          domainToASCII: (domain: string) => domain,
          domainToUnicode: (domain: string) => domain,
        },
        util: {
          getPromiseDetails: (x: Promise<any>) => x && x.toString(),
          // getProxyDetails: (x: Promise<any>) => (x && x.prototype  instanceof Proxy ? x.toString() : undefined),
          getProxyDetails: (x: Promise<any>) => undefined,
          setHiddenValue: (obj: any, key: string, value: any) => {},
          getOwnNonIndexProperties: (x: any, filter: any) => {
            return Object.getOwnPropertyDescriptors(x);
          },
          getExternalValue: (x: any) => x,
          previewEntries: (x: any) => {
            return [Object.entries(x), false];
          },
          // isAnyArrayBuffer: (x: any) => x instanceof ArrayBuffer,
          // isUint8Array: (x: any) => x instanceof Uint8Array,
          // isDataView: (x: any) => x instanceof DataView,
          // isExternal: (x: any) => false,
          // isMap: (x: any) => x instanceof Map,
          // isMapIterator: (x: any) => (x || {}).constructor === new Map().entries().constructor,
          // isPromise: (x: any) => x instanceof Promise,
          // isSet: (x: any) => x instanceof Set,
          // isSetIterator: (x: any) => (x || {}).constructor === new Set().entries().constructor,
          // isTypedArray: (x: any) =>
          //   x instanceof Int8Array ||
          //   x instanceof Uint8Array ||
          //   x instanceof Uint8ClampedArray ||
          //   x instanceof Int16Array ||
          //   x instanceof Uint16Array ||
          //   x instanceof Int32Array ||
          //   x instanceof Uint32Array ||
          //   x instanceof Float32Array ||
          //   x instanceof Float64Array,
          // isRegExp: (x: any) => x instanceof RegExp,
          // isDate: (x: any) => x instanceof Date,
          getConstructorName: (x: any) => x && x.constructor && x.constructor.name,
          // kPending,
          // kRejected,
          // startSigintWatchdog: () => {},
          // stopSigintWatchdog: () => {},
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
          WeakReference: class WeakReference {},
          propertyFilter: {
            ALL_PROPERTIES: 0,
            ONLY_WRITABLE: 1,
            ONLY_ENUMERABLE: 2,
            ONLY_CONFIGURABLE: 4,
            SKIP_STRINGS: 8,
            SKIP_SYMBOLS: 16,
          },
        },
        uv: {
          UV_EADDRINUSE: constants.os.errno.EADDRINUSE,
          UV_EINVAL: constants.os.errno.EINVAL,
          UV_ENOTCONN: constants.os.errno.ENOTCONN,
        },
        v8: {},
        wasi: {},
        worker: newLocal,
        watchdog: {},
        icu: {},
        dtrace: {},
      }[name],
    );
  };
};

enum AsyncWrapField {
  kInit,
  kBefore,
  kAfter,
  kDestroy,
  kPromiseResolve,
  kTotals,
  kCheck,
  kStackLength,
  kUsesExecutionAsyncResource,
  kFieldsCount,
}

enum AsyncWrapUidField {
  kExecutionAsyncId,
  kTriggerAsyncId,
  kAsyncIdCounter,
  kDefaultTriggerAsyncId,
  kUidFieldsCount,
}
let async_ids_stack = new Float64Array(100);
let async_id_fields = new Float64Array(5 * 2);
let async_hook_fields = new Int32Array(10);

const async_wrap = {
  // async_id_fields[AsyncWrapUidField.kDe] = -1;
  // let async_hook_fields =
  constants: {
    kInit: AsyncWrapField.kInit,
    kBefore: AsyncWrapField.kBefore,
    kAfter: AsyncWrapField.kAfter,
    kDestroy: AsyncWrapField.kDestroy,
    kPromiseResolve: AsyncWrapField.kPromiseResolve,
    kTotals: AsyncWrapField.kTotals,
    kCheck: AsyncWrapField.kCheck,
    kStackLength: AsyncWrapField.kStackLength,
    kUsesExecutionAsyncResource: AsyncWrapField.kUsesExecutionAsyncResource,
    kExecutionAsyncId: AsyncWrapUidField.kExecutionAsyncId,
    kTriggerAsyncId: AsyncWrapUidField.kTriggerAsyncId,
    kAsyncIdCounter: 1,
    kDefaultTriggerAsyncId: -1,
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

  async_id_fields,
  async_hook_fields,
  async_ids_stack,
  execution_async_resources: [],
};
