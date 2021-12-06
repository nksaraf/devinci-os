import type { TransferHandler } from './comlink/mod';

import type { WireValue } from './protocol';
import { WireValueType } from './protocol';
import Stats from '../fs/core/stats';
import { RemoteFile } from '../fs/remote';

const transferHandlers = new Map<string, TransferHandler<unknown, unknown>>();

let StatsHandler = {
  canHandle: (value: any): value is Stats => value instanceof Stats,
  serialize: (value: Stats) => [
    {
      dev: value.dev,
      ino: value.ino,
      mode: value.mode,
      size: value.size,
      mtime: value.mtimeMs,
      atime: value.atimeMs,
      isFile: value.isFile,
      isDirectory: value.isDirectory,
      itemType: value.itemType,
    } as const,
    [],
  ],
  deserialize: (value: any): Stats =>
    new Stats(value.itemType, value.size, undefined, value.atime, value.mtime),
} as TransferHandler<
  Stats,
  {
    dev: number;
    ino: number;
    mode: number;
    size: number;
    mtime: number;
    atime: number;
    isFile: boolean;
    isDirectory: boolean;
    itemType: number;
  }
>;
transferHandlers.set('STATS', StatsHandler);

transferHandlers.set('REMOTE_FILE', {
  canHandle: (obj): obj is RemoteFile => obj instanceof RemoteFile,
  serialize: (obj: RemoteFile) => {
    return [
      {
        path: obj.getPath(),
        stats: StatsHandler.serialize(obj.getStats()),
        flag: obj.getFlag(),
      },
      [],
    ];
  },
  deserialize: (obj) => new RemoteFile(obj.path, obj.flag, StatsHandler.deserialize(obj.stats)),
} as TransferHandler<
  RemoteFile,
  {
    path: string;
    stats: any;
    flag: number;
  }
>);

transferHandlers.set('ARRAY_BUFFER', {
  canHandle: (obj): obj is Uint8Array => obj instanceof Uint8Array,
  serialize: (obj: Uint8Array) => {
    return [new TextDecoder().decode(obj), []];
  },
  deserialize: (obj) => new TextEncoder().encode(obj),
} as TransferHandler<Uint8Array, string>);

export function fromWireValue(val: WireValue) {
  if (val.type === WireValueType.RAW) {
    return val.value;
  }

  if (val.type === WireValueType.HANDLER) {
    console.debug(transferHandlers);
    return transferHandlers.get(val.name)?.deserialize(val.value);
  }
}

export function toWireValue(value: any): [WireValue, Transferable[]] {
  for (const [name, handler] of transferHandlers) {
    if (handler.canHandle(value)) {
      const [serializedValue, transferables] = handler.serialize(value);
      return [
        {
          type: WireValueType.HANDLER,
          name,
          value: serializedValue,
        },
        [],
      ];
    }
  }
  return [
    {
      type: WireValueType.RAW,
      value,
    },
    [],
    // transferHandlers.get(value) || [],
  ];
}
