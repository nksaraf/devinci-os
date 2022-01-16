export type Op = {
  name: string;
  sync?: Function;
  async?: Function;
};

export interface Resource {
  type: string;
  read(data: Uint8Array): Promise<number>;
  write(data: Uint8Array): Promise<number>;
  close(): void;
  shutdown(): Promise<void>;
}

export class Resource implements Resource {
  type = 'resource';
  async read(data: Uint8Array): Promise<number> {
    throw new Error('Method not implemented.');
  }

  async write(data: Uint8Array): Promise<number> {
    throw new Error('Method not implemented.');
  }

  close(): void {
    throw new Error('Method not implemented.');
  }

  async shutdown(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export type ResourceTable = { [key: number]: Resource };

export const resourceTableSymbol = Symbol('resourceTable');

export function createResourceTable(): ResourceTable {
  let table = {};
  table[resourceTableSymbol] = true;
  return table;
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

export function op_sync(name: string, execute: Function): Op {
  return {
    name,
    async: execute,
    sync: execute,
  };
}

export function op_async(
  name: string,
  execute: (this: any, arg1: any, arg2: any) => Promise<any>,
): Op {
  return {
    name,
    sync: execute,
    async: execute,
  };
}
