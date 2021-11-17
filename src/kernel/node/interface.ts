export interface Resource {
  read(data: Uint8Array): ReadableStream;

  write(data: Uint8Array): WritableStream;
  close?(): WritableStream;
}

export type ResourceTable = Map<number, Resource>;
