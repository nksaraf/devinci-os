export interface Resource {
  name: string;
  read(data: Uint8Array): Promise<number>;
  write(data: Uint8Array): Promise<number>;
  close(): void;
  shutdown(): Promise<void>;
}

export class Resource implements Resource {
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

export type ResourceTable = Map<number, Resource>;
