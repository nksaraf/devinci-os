export interface Resource {
  name: string;
  read(data: Uint8Array): ReadableStream;
  write(data: Uint8Array): WritableStream;
  close(): void;
  shutdown(): Promise<void>;
}

export class Resource implements Resource {
  read(data: Uint8Array): ReadableStream {
    throw new Error('Method not implemented.');
  }

  write(data: Uint8Array): WritableStream {
    throw new Error('Method not implemented.');
  }

  close(): void {
    throw new Error('Method not implemented.');
  }

  shutdown(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export type ResourceTable = Map<number, Resource>;
