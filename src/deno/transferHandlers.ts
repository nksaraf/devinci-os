import type { TransferHandler } from './comlink';
import type { WireValue } from './comlink/protocol';
import { WireValueType } from './comlink/protocol';
import Stats from 'os/kernel/fs/core/stats';

const transferHandlers = new Map<string, TransferHandler<unknown, unknown>>();
transferHandlers.set('STATS', {
  canHandle: (value: any): value is Stats => value instanceof Stats,
  serialize: (value: Stats): [any, Transferable[]] => [
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
    },
    [],
  ],
  deserialize: (value: any): Stats =>
    new Stats(value.itemType, value.size, undefined, value.atime, value.mtime),
});

export function fromWireValue(val: WireValue) {
  if (val.type === WireValueType.RAW) {
    return val.value;
  }

  if (val.type === WireValueType.HANDLER) {
    console.log(transferHandlers);
    return transferHandlers.get(val.name).deserialize(val.value);
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
