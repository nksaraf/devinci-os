import type { TransferHandler } from './comlink';
import type { WireValue } from './comlink/protocol';
import { WireValueType } from './comlink/protocol';
import Stats from 'os/kernel/fs/core/stats';
import { constants } from 'os/kernel/kernel/constants';

const transferHandlers = new Map<string, TransferHandler<unknown, unknown>>();
transferHandlers.set('STATS', {
  canHandle: (value: any): value is Stats => value instanceof Stats,
  serialize: (value: Stats): [any, Transferable[]] => [
    {
      dev: value.dev,
      ino: value.ino,
      mode: value.mode,
      size: value.size,
      mtime: value.mtime,
      atime: value.atime,
      isFile: value.isFile,
      isDirectory: value.isDirectory,
    },
    [],
  ],
  deserialize: (value: any): Stats =>
    new Stats(value.mode & constants.fs.S_IFMT, value.size, value.mode, value.atime, value.mtime),
});

export function fromWireValue(val: WireValue) {
  if (val.type === WireValueType.RAW) {
    return val.value;
  }

  if (val.type === WireValueType.HANDLER) {
    return transferHandlers[val.name].deserialize(val);
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
