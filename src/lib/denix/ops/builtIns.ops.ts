import { op_async, op_sync } from '../types';
import type { Kernel } from '../denix';

export const builtIns = [
  op_sync('op_close', function (this: Kernel, rid) {
    console.log('closing', rid);
    if (!this.resourceTable.has(rid)) {
      return;
    }
    let resource = this.getResource(rid);
    resource.close();
    this.resourceTable.delete(rid);
  }),
  op_sync('op_try_close', function (this: Kernel, rid) {
    console.log('try closing', rid);
    let resource = this.getResource(rid);
    try {
      resource.close();
      this.resourceTable.delete(rid);
    } catch (e) {
      console.log('couldnt close', rid, resource);
    }
  }),
  op_sync('op_print', function (this: Kernel, msg: string, is_err: boolean) {
    console.log(msg);
  }),
  {
    name: 'op_read',
    sync: () => {},
    async: async function (this: Kernel, rid: number, data: Uint8Array) {
      let resource = this.getResource(rid);
      return await resource.read(data);
    },
  },
  {
    name: 'op_write',
    sync: () => {},
    async: async function (this: Kernel, rid: number, data: Uint8Array) {
      let resource = this.getResource(rid);
      return await resource.write(data);
    },
  },
  op_async('op_shutdown', async function (this: Kernel, rid: number) {
    let resource = this.getResource(rid);
    return await resource.shutdown();
  }),
  op_sync('op_get_env', function (this: Kernel, key: string) {
    return this.env[key] ?? '';
  }),
  op_sync('op_set_env', function (this: Kernel, key: string, val: string) {
    this.env[key] = val;
  }),
  op_sync('op_signal_bind', function (this: Kernel, signal: string, val: string) {
    // this.env[key] = val;
    this.addEventListener('signal', (e) => {});
  }),
];
