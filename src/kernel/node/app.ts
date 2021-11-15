/// <reference path="../../types/vfs.ts" />
/// <reference path="../../types/env.ts" />
{
  // stack trace manipulation
  type StackFrame = { func?: string; file: string; line: number; column: number };
  type StackTrace = {};
  const getStackTrace = () => new Error().stack;

  const selfAny: any = self;
  let env: Environment;
  const fscache: { [name: string]: any } = {};

  const errAny = (e: any): never => {
    throw e;
  };

  const err = (message: string, code?: string): never => {
    const e = new Error(message);
    if (code) (e as any).code = code;
    throw e;
  };

  const errNotImpl = (name: string): never => {
    console.error(`${name} not implemented`);
    err('not implemented');
    throw 'not implemented';
  };

  // rescue required browser/worker-specific globals
  const URL = selfAny.URL;
  const Blob = selfAny.Blob;
  const postMessage = selfAny.postMessage;
  const XMLHttpRequest = selfAny.XMLHttpRequest;
  const exit = selfAny.close;
  const setInterval = selfAny.setInterval;
  const clearInterval = selfAny.clearInterval;
  const setTimeout = selfAny.setTimeout;
  const clearTimeout = selfAny.clearTimeout;
  const TextDecoder = selfAny.TextDecoder;
  const TextEncoder = selfAny.TextEncoder;
  const crypto = selfAny.crypto;
  const arr2str = (arr: ByteBuffer): string => new TextDecoder().decode(arr);
  const console = selfAny.console;

  const writeBack = (absolutePath: string, content: ByteBuffer | null | undefined) => {
    postMessage({ f: 'WRITE', x: { path: absolutePath, content: content } });
  };

  const isDirIndicator = (absolutePath: string) => `<title>Index of ${absolutePath}`;

  const isDir = (absolutePath: string, buffer: ByteBuffer | undefined): boolean =>
    !!buffer && arr2str(buffer).includes(isDirIndicator(absolutePath));

  const rawReadHttpServer = (absolutePath: string): ByteBuffer | undefined => {
    const request = new XMLHttpRequest();
    request.responseType = 'arraybuffer';
    request.open('GET', absolutePath, false);
    request.send(null);
    if (request.status === 200) {
      writeBack(absolutePath, request.response);
      return new Uint8Array(request.response);
    }
    return undefined;
  };
  const throwENOENT = (absolutePath: string) =>
    err(`ENOENT: no such file or directory, scandir '${absolutePath}'`, 'ENOENT');
  const throwENOTDIR = (absolutePath: string) =>
    err(`ENOTDIR: not a directory, scandir '${absolutePath}'`, 'ENOTDIR');

  const readFileSync = (absolutePath: string): ByteBuffer => {
    const data = fscache[absolutePath];
    if (data !== undefined) {
      if (data === null) return throwENOENT(absolutePath);
      return data.slice(); // Return a mutable copy.
    }

    // - try vfs
    {
      if (absolutePath in env.fs)
        return env.fs[absolutePath] === null
          ? err('TODO: correct message')
          : env.fs[absolutePath] === undefined
          ? throwENOENT(absolutePath)
          : (env.fs[absolutePath] as any);
    }

    // - try server
    if (!('__NOHTTP' in env.fs)) {
      const result = rawReadHttpServer(absolutePath);
      if (!result) {
        fscache[absolutePath] = null;
        return throwENOENT(absolutePath);
      }
      if (isDir(absolutePath, result)) err('TODO: correct message');
      fscache[absolutePath] = result;
      return (env.fs[absolutePath] = result);
    }

    // - fail
    fscache[absolutePath] = null;
    return throwENOENT(absolutePath);
  };

  const readDirSync = (absolutePath: string): string[] => {
    const data = fscache[absolutePath];
    if (data !== undefined) {
      if (data === null) throwENOENT(absolutePath);
      return data;
    }

    // evidence for file-ness?
    if (
      absolutePath in env.fs &&
      env.fs[absolutePath] !== null &&
      env.fs[absolutePath] !== undefined
    )
      throwENOTDIR(absolutePath);
    const envFsExists = Object.keys(env.fs).some((x) => x.startsWith(absolutePath));
    // known files?
    let files = Object.keys(env.fs)
      .filter((x) => x.startsWith(absolutePath + '/'))
      .map((x) => x.slice(absolutePath.length + 1))
      .filter((x) => !x.includes('/'));

    // - try server
    if (!('__NOHTTP' in env.fs)) {
      const result = rawReadHttpServer(absolutePath);
      if (result !== undefined) {
        if (!isDir(absolutePath, result)) throwENOTDIR(absolutePath);
        // add files
        const raw = arr2str(result);
        let matches = raw.match(/>[^<>]+<\/a><\/td>/g) || [];
        matches = matches.map((x) => x.slice(1, -9));
        matches = matches.map((x) => (x.endsWith('/') ? x.slice(0, -1) : x));
        matches = matches.filter((x) => x !== '..');
        files.push(...matches);
      } else if (!envFsExists) {
        fscache[absolutePath] = null;
        throwENOENT(absolutePath);
      }
    }

    // normalize
    files = files.sort();
    files = files.filter((f, i) => i === 0 || f !== files[i - 1]);
    fscache[absolutePath] = files;
    return files;
  };

  const existsFolderSync = (absolutePath: string): boolean => {
    try {
      return Array.isArray(readDirSync(absolutePath));
    } catch {
      return false;
    }
  };

  const existsSync = (absolutePath: string): boolean => {
    try {
      readFileSync(absolutePath);
      return true;
    } catch {
      return false;
    }
  };

  const join = (basePath: string, relative: string) => {
    let path = basePath + '/' + relative;
    function normalizeArray(parts: string[]) {
      var up = 0;
      for (var i = parts.length - 1; i >= 0; i--) {
        var last = parts[i];
        if (last === '.') {
          parts.splice(i, 1);
        } else if (last === '..') {
          parts.splice(i, 1);
          up++;
        } else if (up) {
          parts.splice(i, 1);
          up--;
        }
      }
      return parts;
    }
    path = normalizeArray(path.split('/').filter((p) => !!p)).join('/');
    return '/' + path;
  };

  // ENTRY POINT
  selfAny.onmessage = function (msg: MessageEvent) {
    if (msg.data.type !== 'start') return;
    env = msg.data.env;

    // BOOT
    const nativesKeys = [
      'internal/bootstrap_node',
      'async_hooks',
      'assert',
      'buffer',
      'child_process',
      'console',
      'constants',
      'crypto',
      'cluster',
      'dgram',
      'dns',
      'domain',
      'events',
      'fs',
      'http',
      '_http_agent',
      '_http_client',
      '_http_common',
      '_http_incoming',
      '_http_outgoing',
      '_http_server',
      'https',
      'inspector',
      'module',
      'net',
      'os',
      'path',
      'perf_hooks',
      'process',
      'punycode',
      'querystring',
      'readline',
      'repl',
      'stream',
      '_stream_readable',
      '_stream_writable',
      '_stream_duplex',
      '_stream_transform',
      '_stream_passthrough',
      '_stream_wrap',
      'string_decoder',
      'sys',
      'timers',
      'tls',
      '_tls_common',
      '_tls_legacy',
      '_tls_wrap',
      'tty',
      'url',
      'util',
      'v8',
      'vm',
      'zlib',
      'internal/buffer',
      'internal/child_process',
      'internal/cluster/child',
      'internal/cluster/master',
      'internal/cluster/round_robin_handle',
      'internal/cluster/shared_handle',
      'internal/cluster/utils',
      'internal/cluster/worker',
      // 'internal/crypto/certificate',
      // 'internal/crypto/cipher',
      // 'internal/crypto/diffiehellman',
      // 'internal/crypto/hash',
      // 'internal/crypto/pbkdf2',
      // 'internal/crypto/random',
      // 'internal/crypto/sig',
      // 'internal/crypto/util',
      'internal/encoding',
      'internal/errors',
      'internal/freelist',
      'internal/fs',
      'internal/http',
      'internal/inspector_async_hook',
      'internal/linkedlist',
      'internal/loader/Loader',
      'internal/loader/ModuleJob',
      'internal/loader/ModuleMap',
      'internal/loader/ModuleWrap',
      'internal/loader/resolveRequestUrl',
      'internal/loader/search',
      'internal/net',
      'internal/module',
      'internal/os',
      'internal/process',
      'internal/process/next_tick',
      'internal/process/promises',
      'internal/process/stdio',
      'internal/process/warning',
      'internal/process/write-coverage',
      'internal/querystring',
      'internal/readline',
      'internal/repl',
      'internal/safe_globals',
      'internal/socket_list',
      'internal/test/unicode',
      'internal/url',
      'internal/util',
      'internal/v8_prof_polyfill',
      'internal/v8_prof_processor',
      'internal/streams/lazy_transform',
      'internal/streams/BufferList',
      'internal/streams/legacy',
      'internal/streams/destroy',
    ];
    const natives: { [name: string]: string } = {};
    for (const nativesKey of nativesKeys)
      natives[nativesKey] = arr2str(
        readFileSync(`/node/${nativesKey}.js`) || err(`missing native '${nativesKey}'`),
      );
    natives['config'] =
      '\n{"target_defaults":{"cflags":[],"default_configuration":"Release","defines":[],"include_dirs":[],"libraries":[]},"variables":{"asan":0,"coverage":false,"debug_devtools":"node","force_dynamic_crt":0,"host_arch":"x64","icu_data_file":"icudt59l.dat","icu_data_in":"..\\\\..\\\\deps/icu-small\\\\source/data/in\\\\icudt59l.dat","icu_endianness":"l","icu_gyp_path":"tools/icu/icu-generic.gyp","icu_locales":"en,root","icu_path":"deps/icu-small","icu_small":true,"icu_ver_major":"59","node_byteorder":"little","node_enable_d8":false,"node_enable_v8_vtunejit":false,"node_install_npm":true,"node_module_version":57,"node_no_browser_globals":false,"node_prefix":"/usr/local","node_release_urlbase":"https://nodejs.org/download/release/","node_shared":false,"node_shared_cares":false,"node_shared_http_parser":false,"node_shared_libuv":false,"node_shared_openssl":false,"node_shared_zlib":false,"node_tag":"","node_use_bundled_v8":true,"node_use_dtrace":false,"node_use_etw":true,"node_use_lttng":false,"node_use_openssl":true,"node_use_perfctr":true,"node_use_v8_platform":true,"node_without_node_options":false,"openssl_fips":"","openssl_no_asm":0,"shlib_suffix":"so.57","target_arch":"x64","v8_enable_gdbjit":0,"v8_enable_i18n_support":1,"v8_enable_inspector":1,"v8_no_strict_aliasing":1,"v8_optimized_debug":0,"v8_promise_internal_field_count":1,"v8_random_seed":0,"v8_use_snapshot":true,"want_separate_host_toolset":0,"want_separate_host_toolset_mkpeephole":0}}'.replace(
        /"/g,
        `'`,
      );
    //env.fs["__NOHTTP"] = null;

    const newContext = (target: any = {}) =>
      new Proxy(target, {
        has: () => true,
        get: (_, k) => {
          if (k in target) return target[k];
          if (typeof k === 'string' && /^[_a-zA-Z]+$/.test(k)) {
            try {
              return eval(k);
            } catch (e) {
              if (e instanceof ReferenceError) return undefined; // TODO: this is a workaround for `typeof ...` - would throw ReferenceError otherwise! :(
              throw e;
            }
          }
          return eval(k as string);
        },
      });
    const theContext = newContext({});

    class ContextifyScript {
      public constructor(
        private code: string,
        private options: { displayErrors: boolean; filename: string; lineOffset: number },
      ) {}

      public runInThisContext(): any {
        // try {

        // sinful code
        return eval(
          '(() => { with (theContext) { return eval(this.code + `\\n//# sourceURL=${this.options.filename}`); } })()',
        );

        // } catch (e) {
        //   debugger;
        // }
      }
    }

    class ChannelWrap {
      public constructor() {}
    }

    class TTY {
      private _fd: number;
      private _unknown: boolean;

      public constructor(fd: number, unknown: boolean) {
        this._fd = fd;
        this._unknown = unknown;
        _handleWrapQueue.push(this);

        if (fd === 0) {
          const onChar = (c: string) => {
            //if (this.reading) {
            const buffer = new TextEncoder().encode(c);
            this.onread(buffer.length, buffer);
            // }
          };
          selfAny.onmessage = (msg: MessageEvent) => {
            if (msg.data.type !== 'stdin') return;
            // onChar(msg.data.ch);
            (this as any).owner.emit('keypress', msg.data.ch, msg.data.key);
          };
        }
      }

      public onread(nread: number, buffer: Buffer): void {}
      public reading: boolean = false;

      public getWindowSize(size: [number, number]): any /*error*/ {
        size[0] = 120; // cols
        size[1] = 30; // rows
      }

      public readStart(): any /*error?*/ {}

      public readStop(): any /*no clue*/ {}

      public setBlocking(blocking: boolean): void {}

      public setRawMode(rawMode: boolean): void {}

      public writeAsciiString(req: any, data: any) {
        errNotImpl('writeAsciiString');
      }

      public writeBuffer(req: any, data: any) {
        errNotImpl('writeBuffer');
      }

      public writeLatin1String(req: any, data: any) {
        errNotImpl('writeLatin1String');
      }

      public writeUcs2String(req: any, data: any) {
        errNotImpl('writeUcs2String');
      }

      public writeUtf8String(req: any, data: string) {
        switch (this._fd) {
          case 1: // stdout
            postMessage({ f: 'stdout', x: data });
            break;
          case 2: // stderr
            postMessage({ f: 'stderr', x: data });
            break;
        }
      }

      public close(): void {
        _handleWrapQueue.splice(_handleWrapQueue.indexOf(this), 1);
      }
    }

    const _handleWrapQueue: any[] = [];

    const startTime = Date.now();

    class Timer {
      public static get kOnTimeout(): number {
        return 0;
      }

      public static now(): number {
        return Date.now() - startTime;
      }

      public constructor() {
        this.__handle = null;
        _handleWrapQueue.push(this);
      }

      [k: number]: () => void;

      private __handle: number | null;

      public start(delay: number): void {
        if (this.__handle === null)
          this.__handle = setInterval(() => this[Timer.kOnTimeout](), delay);
      }

      public stop(): void {
        if (this.__handle !== null) clearInterval(this.__handle);
      }

      public close(): void {
        _handleWrapQueue.splice(_handleWrapQueue.indexOf(this), 1);
      }

      public unref(): void {
        // TODO
      }
    }

    class TCP {}

    class ShutdownWrap {}

    class WriteWrap {
      public constructor() {}
    }

    class PerformanceEntry {}

    class HTTPParser {
      public static readonly RESPONSE = 0;
      public reinitialize(_: number): void {}
    }

    class FSReqWrap {
      public oncomplete(a: any = null, b: any = null) {}
    }

    function faker<T>(name: string, target: any): T {
      return new Proxy(target, {
        has: (_target, key): boolean => {
          if (key in target) return true;
          console.warn(`${name}.${String(key)} has`);
          return false;
        },

        get: (_target, key): any => {
          if (key in target) return target[key];
          console.warn(`${name}.${String(key)} get`);
          return undefined;
        },

        set: (_target, key, value, _receiver): boolean => {
          if (key in target) {
            target[key] = value;
            return true;
          }
          console.warn(`${name}.${String(key)} set to ${value}`);
          return false;
        },
      }) as T;
    }

    let cwd = '/mnt';

    const statValues = new Float64Array([
      1458881089, // device ID
      33207, // mode | protection
      1, // # hard links
      0, // owner's user ID
      0, // 4 - owner's group ID
      0, // device ID if special file
      -1, // block size
      8162774324649504, // iNode number
      58232, // 8 - size
      -1, // # blocks
      1484478676521.9932, // last access
      1506412651257.9966, // last modification
      1506412651257.9966, // last iNode modification?
      1484478676521.9932, // creation time?
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);

    let global: NodeJS.Global = self as any;
    global.global = global;

    const runMicrotasks = () => {
      const proc: any = process;
      if (proc._needImmediateCallback) proc._immediateCallback();
      else {
        if (_handleWrapQueue.length === 0) proc.exit(0);
      }
    };

    type FileDescriptor = { s: ByteBuffer; isDir: boolean; _path: string };

    const nextTick = (cb: () => void): void => (process as any).nextTick(cb);

    const process = {
      _getActiveHandles: () => _handleWrapQueue.map((x: any) => x.owner || x),

      _getActiveRequests: () => [], // TODO

      _rawDebug: (x: any) => postMessage({ f: 'error', x: { f: '_rawDebug', x: x } }),

      _setupDomainUse: (domain: any, stack: any) => [],

      _setupProcessObject: (pushValueToArrayFunction: Function) => {},

      _setupPromises: () => {},

      _setupNextTick: (_tickCallback: any, _runMicrotasks: any) => {
        _runMicrotasks.runMicrotasks = runMicrotasks;
        setInterval(_tickCallback, 1); // teardown implicit?
        return [0, 0];
      },

      argv: ['node', ...msg.data.args],

      binding: (name: string): any => {
        switch (name) {
          case 'async_wrap':
            return faker(name, {
              clearIdStack: () => {},
              asyncIdStackSize: () => {},
              pushAsyncIds: () => {},
              popAsyncIds: () => {},
              async_hook_fields: [0],
              async_uid_fields: [0],
              constants: {
                kInit: 0,
                kBefore: 1,
                kAfter: 2,
                kDestroy: 3,
                kPromiseResolve: 4,
                kTotals: 5,
                kFieldsCount: 6,
                kAsyncUidCntr: 0,
                kCurrentAsyncId: 0,
                kInitTriggerId: 0,
              },
              setupHooks: () => {},
            }); // TODO

          // TODO: use browserify's Buffer
          case 'buffer':
            return faker(name, {
              byteLengthUtf8: (s: string) => {
                return s.length; // TODO
              },

              setupBufferJS: (proto: any) => {
                proto.utf8Slice = function (this: Buffer, start: number, end: number) {
                  const slice = this.slice(start, end);
                  return new TextDecoder().decode(slice);
                };

                proto.hexSlice = function (start: number, end: number) {
                  const slice = this.slice(start, end);
                  let result = '';
                  for (let i = 0; i < slice.byteLength; ++i) result += slice[i].toString(16);
                  return result;
                };

                proto.utf8Write = function (string: string, offset: number, length: number) {
                  // TODO
                  for (var i = 0; i < length && i < this.byteLength - offset; ++i)
                    this[i + offset] = string.charCodeAt(i);
                  return i;
                };

                proto.hexWrite = function (string: string, offset: number, length: number) {
                  offset = Number(offset) || 0;
                  const remaining = this.length - offset;
                  if (!length) {
                    length = remaining;
                  } else {
                    length = Number(length);
                    if (length > remaining) {
                      length = remaining;
                    }
                  }

                  var strLen = string.length;

                  if (length > strLen / 2) {
                    length = strLen / 2;
                  }
                  for (var i = 0; i < length; ++i) {
                    const parsed = parseInt(string.substr(i * 2, 2), 16);
                    if (Number.isNaN(parsed)) return i;
                    this[offset + i] = parsed;
                  }
                  return i;
                };
              },

              copy: (
                source: Buffer,
                target: Buffer,
                targetStart: number,
                sourceStart: number,
                sourceEnd: number,
              ) => {
                for (
                  let i = sourceStart || 0, j = targetStart || 0;
                  i < (sourceEnd || source.length);
                  i++, j++
                )
                  target[j] = source[i];
              },

              kMaxLength: Number.MAX_SAFE_INTEGER,
              kStringMaxLength: Number.MAX_SAFE_INTEGER,

              /* TODO:
              createFromString: ??,
              compare: ??,
              indexOfString: ??,
              indexOfBuffer: ??,
              indexOfNumber: ??,
              fill: ??,
              readFloatLE: ??,
              readFloatBE: ??,
              readDoubleLE: ??,
              readDoubleBE: ??,
              writeFloatLE: ??,
              writeFloatBE: ??,
              writeDoubleLE: ??,
              writeDoubleBE: ??,
              swap16: ??,
              swap32: ??,
              swap64: ??,
              */
            }); // TODO

          case 'cares_wrap':
            return faker(name, {
              GetAddrInfoReqWrap: () => {},

              GetNameInfoReqWrap: () => {},

              QueryReqWrap: () => {},

              ChannelWrap: ChannelWrap,

              isIP: () => {},

              getaddrinfo: function (
                addr_info_wrap: {
                  family: number;
                  hostname: string;
                  callback: Function;
                  oncomplete: (result: { 0: number; 1: string[] }) => void;
                },
                hostname: string,
                family: number,
                hints: number,
                verbatim: boolean,
              ) {
                addr_info_wrap.oncomplete({ 0: 0, 1: [addr_info_wrap.hostname] });
                return 0; // = success
              },
            }); // TODO

          case 'config':
            return faker(name, {
              hasIntl: false, // CONSIDER:
              exposeHTTP2: false, // CONSIDER:
              exposeInternals: false,
              pendingDeprecation: false,
              experimentalModules: false,
              preserveSymlinks: false, // CONSIDER:
            }); // TODO:

          case 'constants':
            return constants;

          case 'contextify':
            return faker(name, {
              ContextifyScript,
            }); // TODO

          case 'crypto':
            return faker(name, {
              randomBytes: (size: number, cb?: Function) => {
                var rawBytes = new Uint8Array(size);
                if (size > 0) crypto.getRandomValues(rawBytes);
                var bytes = Buffer.from(rawBytes.buffer);
                if (typeof cb === 'function') return global.process.nextTick(() => cb(null, bytes));
                return bytes;
              },

              randomFill: (bytes: Buffer, offset: number, size: number, cb?: Function) => {
                var rawBytes = new Uint8Array(size);
                if (size > 0) crypto.getRandomValues(rawBytes);
                for (let i = 0; i < size; ++i) bytes[offset + i] = rawBytes[i];
                if (typeof cb === 'function') return global.process.nextTick(() => cb(null, bytes)); // guess
                return bytes;
              },
            }); // TODO

          case 'fs':
            const wrap = <T>(f: () => T, req: FSReqWrap | undefined): T => {
              let result: T | undefined = undefined;
              let err: Error | undefined = undefined;
              try {
                result = f();
              } catch (e) {
                err = e;
              }
              if (req) nextTick(() => req.oncomplete(err, result));
              else if (err) throw err;
              return result as any;
            };

            /**
             * Wraps a callback function, ensuring it is invoked through setImmediate.
             * @hidden
             */
            function wrapCb<T extends Function>(cb: T, numArgs: number): T {
              if (typeof cb !== 'function') {
                throw new Error('Callback must be a function.');
              }

              const hookedCb = wrapCbHook(cb, numArgs);

              // We could use `arguments`, but Function.call/apply is expensive. And we only
              // need to handle 1-3 arguments
              switch (numArgs) {
                case 1:
                  return <any>function (arg1: any) {
                    setImmediate(function () {
                      return hookedCb(arg1);
                    });
                  };
                case 2:
                  return <any>function (arg1: any, arg2: any) {
                    setImmediate(function () {
                      return hookedCb(arg1, arg2);
                    });
                  };
                case 3:
                  return <any>function (arg1: any, arg2: any, arg3: any) {
                    setImmediate(function () {
                      return hookedCb(arg1, arg2, arg3);
                    });
                  };
                default:
                  throw new Error('Invalid invocation of wrapCb.');
              }
            }

            const fstat = (fd: FileDescriptor | undefined, req?: FSReqWrap): void => {
              if (fd !== undefined) {
                statValues[1] =
                  (0xf000 & ((fd.isDir ? 0b0100 : 0b1000) << 12)) | (0x0fff & 0x1b7) /*no clue*/;
                statValues[8] = fd.s.byteLength;
              }
              // TODO
              if (req) nextTick(() => req.oncomplete(/*error, if one happened*/));
            };

            return faker(name, {
              getStatValues: () => statValues,

              internalModuleReadFile: (path: string): string | undefined => {
                try {
                  const res = readFileSync(path);
                  return arr2str(res);
                } catch {
                  return undefined;
                }
              },

              internalModuleStat: (path: string) => {
                // dir
                if (existsFolderSync(path)) return 1;
                // file
                if (existsSync(path)) return 0;
                return -4058;
              },

              fstat: fstat,

              lstat: (path: string, req?: FSReqWrap) => {
                try {
                  try {
                    let buffer = readFileSync(path);
                    if (buffer && !Array.isArray(buffer))
                      return fstat({ s: buffer, isDir: false, _path: path }, req);
                  } catch {}
                  if (readDirSync(path))
                    return fstat({ s: new Uint8Array(0), isDir: true, _path: path }, req);
                  err('TODO: correct error treatment');
                } catch {
                  fstat(undefined, req);
                  return;
                }
              },

              stat: (path: string, req?: FSReqWrap) => {
                try {
                  try {
                    let buffer = readFileSync(path);
                    if (buffer && !Array.isArray(buffer))
                      return fstat({ s: buffer, isDir: false, _path: path }, req);
                  } catch {}
                  if (readDirSync(path))
                    return fstat({ s: new Uint8Array(0), isDir: true, _path: path }, req);
                  err('TODO: correct error treatment');
                } catch {
                  fstat(undefined, req);
                  return;
                }
              },

              open: (
                path: string,
                flags: number,
                mode: number,
                req?: FSReqWrap,
              ): FileDescriptor => {
                return wrap<FileDescriptor>(() => {
                  const { O_RDONLY, O_CREAT, O_TRUNC, O_WRONLY } = constants.fs;
                  if (flags === O_RDONLY)
                    return { s: readFileSync(path), isDir: false, _path: path };
                  //if (flags & (O_CREAT | O_TRUNC | O_WRONLY) === (O_CREAT | O_TRUNC } O_WRONLY))
                  //  return { s: readFileSync(path), isDir: false, _path: path };
                  return errNotImpl(`bind.open w/ flags 0x${flags.toString(16)} (${path})`);
                }, req);
              },

              close: (fd: FileDescriptor, req?: FSReqWrap) => {
                wrap<undefined>(() => undefined, req);
              },

              read: (
                fd: FileDescriptor,
                buffer: any,
                offset: number,
                length: number,
                position: number,
                req?: FSReqWrap,
              ): number => {
                return wrap<number>(() => {
                  const s = fd.s;
                  const copy = Math.min(s.length, length);
                  for (let i = 0; i < copy; ++i) buffer[offset + i] = s[i];
                  fd.s = s.slice(copy);
                  return copy;
                }, req);
              },

              readdir: (path: string, encoding: any, req?: FSReqWrap): string[] | any => {
                return wrap<string[]>(() => readDirSync(path), req);
              },

              mkdir: (path: string, mode: number, req?: FSReqWrap): undefined => {
                return wrap<undefined>(() => {
                  try {
                    readDirSync(path);
                  } catch {
                    env.fs[path] = null;
                    return undefined;
                  }
                  return undefined;
                  //                  return err("EEXISTS");
                }, req);
              },

              unlink: (path: string) => {
                console.warn(`fs.unlink ${path} not implemented`);
              },

              FSReqWrap: FSReqWrap,
            }); // TODO

          case 'fs_event_wrap':
            return faker(name, {}); // TODO

          case 'http_parser':
            return faker(name, {
              methods: [],
              HTTPParser: HTTPParser,
            }); // TODO

          case 'inspector':
            return faker(name, {}); // TODO

          case 'js_stream':
            return faker(name, {
              JSStream: () => ({}),
            }); // TODO:

          case 'os':
            return faker(name, {
              getCPUs: () => [], //errNotImpl(),
              getFreeMem: () => errNotImpl('os.getFreeMem'),
              getHomeDirectory: () => '/home/runner',
              getHostname: () => errNotImpl('os.getHostname'),
              getInterfaceAddresses: () => errNotImpl('os.getInterfaceAddresses'),
              getLoadAvg: () => errNotImpl('os.getLoadAvg'),
              getOSRelease: () => '4.4.0-66-generic',
              getOSType: () => 'Linux',
              getTotalMem: () => errNotImpl('os.getTotalMem'),
              getUserInfo: () =>
                [
                  {
                    uid: 1001,
                    gid: 1001,
                    username: 'runner',
                    homedir: '/home/runner',
                    shell: '/bin/bash',
                  },
                ][0],
              getUptime: () => errNotImpl('os.getUptime'),
              isBigEndian: false,
            }); // TODO

          case 'performance':
            return faker(name, {
              constants: {
                NODE_PERFORMANCE_ENTRY_TYPE_NODE: 0,
                NODE_PERFORMANCE_ENTRY_TYPE_MARK: 0,
                NODE_PERFORMANCE_ENTRY_TYPE_MEASURE: 0,
                NODE_PERFORMANCE_ENTRY_TYPE_GC: 0,
                NODE_PERFORMANCE_ENTRY_TYPE_FUNCTION: 0,
                NODE_PERFORMANCE_MILESTONE_NODE_START: 0,
                NODE_PERFORMANCE_MILESTONE_V8_START: 0,
                NODE_PERFORMANCE_MILESTONE_LOOP_START: 0,
                NODE_PERFORMANCE_MILESTONE_LOOP_EXIT: 0,
                NODE_PERFORMANCE_MILESTONE_BOOTSTRAP_COMPLETE: 0,
                NODE_PERFORMANCE_MILESTONE_ENVIRONMENT: 0,
                NODE_PERFORMANCE_MILESTONE_THIRD_PARTY_MAIN_START: 0,
                NODE_PERFORMANCE_MILESTONE_THIRD_PARTY_MAIN_END: 0,
                NODE_PERFORMANCE_MILESTONE_CLUSTER_SETUP_START: 0,
                NODE_PERFORMANCE_MILESTONE_CLUSTER_SETUP_END: 0,
                NODE_PERFORMANCE_MILESTONE_MODULE_LOAD_START: 0,
                NODE_PERFORMANCE_MILESTONE_MODULE_LOAD_END: 0,
                NODE_PERFORMANCE_MILESTONE_PRELOAD_MODULE_LOAD_START: 0,
                NODE_PERFORMANCE_MILESTONE_PRELOAD_MODULE_LOAD_END: 0,
              },
              // mark: _mark,
              markMilestone: () => {},
              // measure: _measure,
              // milestones,
              observerCounts: {},
              PerformanceEntry: PerformanceEntry,
              setupObservers: () => {},
              // timeOrigin,
              // timerify,
            }); // TODO

          case 'pipe_wrap':
            return faker(name, {}); // TODO

          case 'process_wrap':
            return faker(name, {}); // TODO

          case 'module_wrap':
            return faker(name, {}); // TODO

          case 'natives':
            return natives;

          case 'signal_wrap':
            return faker(name, {}); // TODO:

          case 'spawn_sync':
            return faker(name, {
              spawn: () => errNotImpl('spawn'),
            }); // TODO:

          case 'stream_wrap':
            return faker(name, {
              ShutdownWrap: ShutdownWrap,
              WriteWrap: WriteWrap,
            }); // TODO

          case 'tcp_wrap':
            return faker(name, {
              TCP: TCP,
            }); // TODO

          case 'tls_wrap':
            return faker(name, {
              TLSWrap: () => {},
              wrap: (stream: any, context: any, isServer: any) => {},
            }); // TODO:

          case 'timer_wrap':
            return faker(name, {
              Timer: Timer,
            }); // TODO

          case 'tty_wrap':
            return faker(name, {
              isTTY: () => true,
              guessHandleType: (fs: number): string => 'TTY',
              TTY: TTY,
            }); // TODO

          case 'udp_wrap':
            return faker(name, {}); // TODO

          case 'url':
            return faker(name, {
              parse: () => {},
              encodeAuth: () => {},
              toUSVString: () => {},
              domainToASCII: () => {},
              domainToUnicode: () => {},
              setURLConstructor: () => {},
              URL_FLAGS_NONE: 0,
              URL_FLAGS_FAILED: 1,
              URL_FLAGS_CANNOT_BE_BASE: 2,
              URL_FLAGS_INVALID_PARSE_STATE: 4,
              URL_FLAGS_TERMINATED: 8,
              URL_FLAGS_SPECIAL: 16,
              URL_FLAGS_HAS_USERNAME: 32,
              URL_FLAGS_HAS_PASSWORD: 64,
              URL_FLAGS_HAS_HOST: 128,
              URL_FLAGS_HAS_PATH: 256,
              URL_FLAGS_HAS_QUERY: 512,
              URL_FLAGS_HAS_FRAGMENT: 1024,
              kSchemeStart: 0,
              kScheme: 1,
              kNoScheme: 2,
              kSpecialRelativeOrAuthority: 3,
              kPathOrAuthority: 4,
              kRelative: 5,
              kRelativeSlash: 6,
              kSpecialAuthoritySlashes: 7,
              kSpecialAuthorityIgnoreSlashes: 8,
              kAuthority: 9,
              kHost: 10,
              kHostname: 11,
              kPort: 12,
              kFile: 13,
              kFileSlash: 14,
              kFileHost: 15,
              kPathStart: 16,
              kPath: 17,
              kCannotBeBase: 18,
              kQuery: 19,
              kFragment: 20,
            });

          case 'util':
            return faker(name, {
              getPromiseDetails: (x: Promise<any>) => x && x.toString(), // TODO
              getProxyDetails: (x: Promise<any>) => x && x.toString(), // TODO
              isAnyArrayBuffer: (x: any) => x instanceof ArrayBuffer,
              isUint8Array: (x: any) => x instanceof Uint8Array,
              isDataView: (x: any) => x instanceof DataView,
              isExternal: (x: any) => false, // TODO: ???
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
            }); // TODO

          case 'uv':
            return faker(name, {
              errname: function () {
                return `errname(${arguments})`;
              },
              UV_E2BIG: -4093,
              UV_EACCES: -4092,
              UV_EADDRINUSE: -4091,
              UV_EADDRNOTAVAIL: -4090,
              UV_EAFNOSUPPORT: -4089,
              UV_EAGAIN: -4088,
              UV_EAI_ADDRFAMILY: -3000,
              UV_EAI_AGAIN: -3001,
              UV_EAI_BADFLAGS: -3002,
              UV_EAI_BADHINTS: -3013,
              UV_EAI_CANCELED: -3003,
              UV_EAI_FAIL: -3004,
              UV_EAI_FAMILY: -3005,
              UV_EAI_MEMORY: -3006,
              UV_EAI_NODATA: -3007,
              UV_EAI_NONAME: -3008,
              UV_EAI_OVERFLOW: -3009,
              UV_EAI_PROTOCOL: -3014,
              UV_EAI_SERVICE: -3010,
              UV_EAI_SOCKTYPE: -3011,
              UV_EALREADY: -4084,
              UV_EBADF: -4083,
              UV_EBUSY: -4082,
              UV_ECANCELED: -4081,
              UV_ECHARSET: -4080,
              UV_ECONNABORTED: -4079,
              UV_ECONNREFUSED: -4078,
              UV_ECONNRESET: -4077,
              UV_EDESTADDRREQ: -4076,
              UV_EEXIST: -4075,
              UV_EFAULT: -4074,
              UV_EFBIG: -4036,
              UV_EHOSTUNREACH: -4073,
              UV_EINTR: -4072,
              UV_EINVAL: -4071,
              UV_EIO: -4070,
              UV_EISCONN: -4069,
              UV_EISDIR: -4068,
              UV_ELOOP: -4067,
              UV_EMFILE: -4066,
              UV_EMSGSIZE: -4065,
              UV_ENAMETOOLONG: -4064,
              UV_ENETDOWN: -4063,
              UV_ENETUNREACH: -4062,
              UV_ENFILE: -4061,
              UV_ENOBUFS: -4060,
              UV_ENODEV: -4059,
              UV_ENOENT: -4058,
              UV_ENOMEM: -4057,
              UV_ENONET: -4056,
              UV_ENOPROTOOPT: -4035,
              UV_ENOSPC: -4055,
              UV_ENOSYS: -4054,
              UV_ENOTCONN: -4053,
              UV_ENOTDIR: -4052,
              UV_ENOTEMPTY: -4051,
              UV_ENOTSOCK: -4050,
              UV_ENOTSUP: -4049,
              UV_EPERM: -4048,
              UV_EPIPE: -4047,
              UV_EPROTO: -4046,
              UV_EPROTONOSUPPORT: -4045,
              UV_EPROTOTYPE: -4044,
              UV_ERANGE: -4034,
              UV_EROFS: -4043,
              UV_ESHUTDOWN: -4042,
              UV_ESPIPE: -4041,
              UV_ESRCH: -4040,
              UV_ETIMEDOUT: -4039,
              UV_ETXTBSY: -4038,
              UV_EXDEV: -4037,
              UV_UNKNOWN: -4094,
              UV_EOF: -4095,
              UV_ENXIO: -4033,
              UV_EMLINK: -4032,
              UV_EHOSTDOWN: -4031,
            });

          case 'zlib':
            return faker(name, {}); // TODO

          default:
            console.error(`bind("${name}") not even stubbed`);
            throw new Error(`missing binding '${name}'`);
        }
      },

      chdir: (target: string) => {
        cwd = require('path').resolve(cwd, target);
      },

      cwd: () => cwd,

      env: {
        // NODE_DEBUG: "repl,timer,stream,esm,module,net"
      },

      execPath: '/bin/node/app.js',

      moduleLoadList: [] as string[],

      pid: 42,

      reallyExit: (exitCode: number) => {
        postMessage({ f: 'EXIT', x: exitCode });
        while (true); // TODO smarter spin wait? maybe some sync-IO stuff?
        // don't allow any further execution (not caller, but also no timers etc.)
      },

      release: {
        name: 'node-box',
      },

      umask: () => 0,

      version: 'v8.0.0',

      versions: {
        http_parser: '2.7.0',
        node: '8.0.0',
        v8: '5.8.283.41',
        uv: '1.11.0',
        zlib: '1.2.11',
        ares: '1.10.1-DEV',
        modules: '57',
        openssl: '1.0.2k',
        icu: '59.1',
        unicode: '9.0',
        cldr: '31.0.1',
        tz: '2017b',
      },
    };

    Object.setPrototypeOf(process, {});

    const bootstrapper = new ContextifyScript(natives['internal/bootstrap_node'], {
      displayErrors: true,
      filename: 'internal/bootstrap_node',
      lineOffset: 0,
    });
    const bootstrap = bootstrapper.runInThisContext();
    try {
      bootstrap(process);
    } catch (e) {
      console.error(e);
    }
  };

  selfAny.onerror = function (ev: any) {
    postMessage({ f: 'error', x: ev });
  };
}

const constants = {
  os: {
    UV_UDP_REUSEADDR: 4,
    errno: {
      E2BIG: 7,
      EACCES: 13,
      EADDRINUSE: 48,
      EADDRNOTAVAIL: 49,
      EAFNOSUPPORT: 47,
      EAGAIN: 35,
      EALREADY: 37,
      EBADF: 9,
      EBADMSG: 94,
      EBUSY: 16,
      ECANCELED: 89,
      ECHILD: 10,
      ECONNABORTED: 53,
      ECONNREFUSED: 61,
      ECONNRESET: 54,
      EDEADLK: 11,
      EDESTADDRREQ: 39,
      EDOM: 33,
      EDQUOT: 69,
      EEXIST: 17,
      EFAULT: 14,
      EFBIG: 27,
      EHOSTUNREACH: 65,
      EIDRM: 90,
      EILSEQ: 92,
      EINPROGRESS: 36,
      EINTR: 4,
      EINVAL: 22,
      EIO: 5,
      EISCONN: 56,
      EISDIR: 21,
      ELOOP: 62,
      EMFILE: 24,
      EMLINK: 31,
      EMSGSIZE: 40,
      EMULTIHOP: 95,
      ENAMETOOLONG: 63,
      ENETDOWN: 50,
      ENETRESET: 52,
      ENETUNREACH: 51,
      ENFILE: 23,
      ENOBUFS: 55,
      ENODATA: 96,
      ENODEV: 19,
      ENOENT: 2,
      ENOEXEC: 8,
      ENOLCK: 77,
      ENOLINK: 97,
      ENOMEM: 12,
      ENOMSG: 91,
      ENOPROTOOPT: 42,
      ENOSPC: 28,
      ENOSR: 98,
      ENOSTR: 99,
      ENOSYS: 78,
      ENOTCONN: 57,
      ENOTDIR: 20,
      ENOTEMPTY: 66,
      ENOTSOCK: 38,
      ENOTSUP: 45,
      ENOTTY: 25,
      ENXIO: 6,
      EOPNOTSUPP: 102,
      EOVERFLOW: 84,
      EPERM: 1,
      EPIPE: 32,
      EPROTO: 100,
      EPROTONOSUPPORT: 43,
      EPROTOTYPE: 41,
      ERANGE: 34,
      EROFS: 30,
      ESPIPE: 29,
      ESRCH: 3,
      ESTALE: 70,
      ETIME: 101,
      ETIMEDOUT: 60,
      ETXTBSY: 26,
      EWOULDBLOCK: 35,
      EXDEV: 18,
    },
    signals: {
      SIGHUP: 1,
      SIGINT: 2,
      SIGQUIT: 3,
      SIGILL: 4,
      SIGTRAP: 5,
      SIGABRT: 6,
      SIGIOT: 6,
      SIGBUS: 10,
      SIGFPE: 8,
      SIGKILL: 9,
      SIGUSR1: 30,
      SIGSEGV: 11,
      SIGUSR2: 31,
      SIGPIPE: 13,
      SIGALRM: 14,
      SIGTERM: 15,
      SIGCHLD: 20,
      SIGCONT: 19,
      SIGSTOP: 17,
      SIGTSTP: 18,
      SIGTTIN: 21,
      SIGTTOU: 22,
      SIGURG: 16,
      SIGXCPU: 24,
      SIGXFSZ: 25,
      SIGVTALRM: 26,
      SIGPROF: 27,
      SIGWINCH: 28,
      SIGIO: 23,
      SIGINFO: 29,
      SIGSYS: 12,
    },
  },
  fs: {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    O_NONBLOCK: 4,
    O_APPEND: 8,
    O_SYNC: 128,
    O_NOFOLLOW: 256,
    O_CREAT: 512,
    O_TRUNC: 1024,
    O_EXCL: 2048,
    O_NOCTTY: 131072,
    O_DIRECTORY: 1048576,
    O_DSYNC: 4194304,
    O_SYMLINK: 2097152,
    S_IFMT: 61440,
    S_IFREG: 32768,
    S_IFDIR: 16384,
    S_IFCHR: 8192,
    S_IFBLK: 24576,
    S_IFIFO: 4096,
    S_IFLNK: 40960,
    S_IFSOCK: 49152,
    S_IRWXU: 448,
    S_IRUSR: 256,
    S_IWUSR: 128,
    S_IXUSR: 64,
    S_IRWXG: 56,
    S_IRGRP: 32,
    S_IWGRP: 16,
    S_IXGRP: 8,
    S_IRWXO: 7,
    S_IROTH: 4,
    S_IWOTH: 2,
    S_IXOTH: 1,
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
    UV_FS_COPYFILE_EXCL: 1,
    COPYFILE_EXCL: 1,
  },
  crypto: {
    OPENSSL_VERSION_NUMBER: 268443903,
    SSL_OP_ALL: 2147486719,
    SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION: 262144,
    SSL_OP_CIPHER_SERVER_PREFERENCE: 4194304,
    SSL_OP_CISCO_ANYCONNECT: 32768,
    SSL_OP_COOKIE_EXCHANGE: 8192,
    SSL_OP_CRYPTOPRO_TLSEXT_BUG: 2147483648,
    SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS: 2048,
    SSL_OP_EPHEMERAL_RSA: 0,
    SSL_OP_LEGACY_SERVER_CONNECT: 4,
    SSL_OP_MICROSOFT_BIG_SSLV3_BUFFER: 32,
    SSL_OP_MICROSOFT_SESS_ID_BUG: 1,
    SSL_OP_MSIE_SSLV2_RSA_PADDING: 0,
    SSL_OP_NETSCAPE_CA_DN_BUG: 536870912,
    SSL_OP_NETSCAPE_CHALLENGE_BUG: 2,
    SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG: 1073741824,
    SSL_OP_NETSCAPE_REUSE_CIPHER_CHANGE_BUG: 8,
    SSL_OP_NO_COMPRESSION: 131072,
    SSL_OP_NO_QUERY_MTU: 4096,
    SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION: 65536,
    SSL_OP_NO_SSLv2: 16777216,
    SSL_OP_NO_SSLv3: 33554432,
    SSL_OP_NO_TICKET: 16384,
    SSL_OP_NO_TLSv1: 67108864,
    SSL_OP_NO_TLSv1_1: 268435456,
    SSL_OP_NO_TLSv1_2: 134217728,
    SSL_OP_PKCS1_CHECK_1: 0,
    SSL_OP_PKCS1_CHECK_2: 0,
    SSL_OP_SINGLE_DH_USE: 1048576,
    SSL_OP_SINGLE_ECDH_USE: 524288,
    SSL_OP_SSLEAY_080_CLIENT_DH_BUG: 128,
    SSL_OP_SSLREF2_REUSE_CERT_TYPE_BUG: 0,
    SSL_OP_TLS_BLOCK_PADDING_BUG: 512,
    SSL_OP_TLS_D5_BUG: 256,
    SSL_OP_TLS_ROLLBACK_BUG: 8388608,
    ENGINE_METHOD_RSA: 1,
    ENGINE_METHOD_DSA: 2,
    ENGINE_METHOD_DH: 4,
    ENGINE_METHOD_RAND: 8,
    ENGINE_METHOD_ECDH: 16,
    ENGINE_METHOD_ECDSA: 32,
    ENGINE_METHOD_CIPHERS: 64,
    ENGINE_METHOD_DIGESTS: 128,
    ENGINE_METHOD_STORE: 256,
    ENGINE_METHOD_PKEY_METHS: 512,
    ENGINE_METHOD_PKEY_ASN1_METHS: 1024,
    ENGINE_METHOD_ALL: 65535,
    ENGINE_METHOD_NONE: 0,
    DH_CHECK_P_NOT_SAFE_PRIME: 2,
    DH_CHECK_P_NOT_PRIME: 1,
    DH_UNABLE_TO_CHECK_GENERATOR: 4,
    DH_NOT_SUITABLE_GENERATOR: 8,
    NPN_ENABLED: 1,
    ALPN_ENABLED: 1,
    RSA_PKCS1_PADDING: 1,
    RSA_SSLV23_PADDING: 2,
    RSA_NO_PADDING: 3,
    RSA_PKCS1_OAEP_PADDING: 4,
    RSA_X931_PADDING: 5,
    RSA_PKCS1_PSS_PADDING: 6,
    RSA_PSS_SALTLEN_DIGEST: -1,
    RSA_PSS_SALTLEN_MAX_SIGN: -2,
    RSA_PSS_SALTLEN_AUTO: -2,
    POINT_CONVERSION_COMPRESSED: 2,
    POINT_CONVERSION_UNCOMPRESSED: 4,
    POINT_CONVERSION_HYBRID: 6,
    defaultCoreCipherList:
      'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-SHA256:DHE-RSA-AES256-SHA256:HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
    defaultCipherList:
      'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-SHA256:DHE-RSA-AES256-SHA256:HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
  },
  zlib: {
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    Z_VERSION_ERROR: -6,
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    ZLIB_VERNUM: 4784,
    DEFLATE: 1,
    INFLATE: 2,
    GZIP: 3,
    GUNZIP: 4,
    DEFLATERAW: 5,
    INFLATERAW: 6,
    UNZIP: 7,
    Z_MIN_WINDOWBITS: 8,
    Z_MAX_WINDOWBITS: 15,
    Z_DEFAULT_WINDOWBITS: 15,
    Z_MIN_CHUNK: 64,
    Z_MAX_CHUNK: Infinity,
    Z_DEFAULT_CHUNK: 16384,
    Z_MIN_MEMLEVEL: 1,
    Z_MAX_MEMLEVEL: 9,
    Z_DEFAULT_MEMLEVEL: 8,
    Z_MIN_LEVEL: -1,
    Z_MAX_LEVEL: 9,
    Z_DEFAULT_LEVEL: -1,
  },
};
