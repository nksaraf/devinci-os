import type { Process } from '../denix';
import { op_async, op_sync, Resource } from '../types';

export const test = [
  op_sync('op_get_test_origin', function (this: Process, resource: Resource): string {
    return location.origin;
  }),
  op_sync('op_dispatch_test_event', function (this: Process, data) {
    console.log(data);
  }),
];
