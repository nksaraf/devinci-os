export type Op = {
  name: string;
  sync?: Function;
  async?: Function;
};

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
