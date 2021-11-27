import type {
  SyncKeyValueStore,
  SimpleSyncStore,
  SyncKeyValueRWTransaction,
} from './core/key_value_filesystem';
import { SimpleSyncRWTransaction, SyncKeyValueFileSystem } from './core/key_value_filesystem';
/**
 * A simple in-memory key-value store backed by a JavaScript object.
 */
export class InMemoryStore implements SyncKeyValueStore, SimpleSyncStore {
  private store: { [key: string]: Uint8Array } = {};

  public name() {
    return InMemoryFileSystem.Name;
  }
  public clear() {
    this.store = {};
  }

  public beginTransaction(type: string): SyncKeyValueRWTransaction {
    return new SimpleSyncRWTransaction(this);
  }

  public get(key: string): Uint8Array {
    return this.store[key];
  }

  public put(key: string, data: Uint8Array, overwrite: boolean): boolean {
    if (!overwrite && this.store.hasOwnProperty(key)) {
      return false;
    }
    this.store[key] = data;
    return true;
  }

  public del(key: string): void {
    delete this.store[key];
  }
}

/**
 * A simple in-memory file system backed by an InMemoryStore.
 * Files are not persisted across page loads.
 */
export default class InMemoryFileSystem extends SyncKeyValueFileSystem {
  public static readonly Name = 'InMemory';

  constructor() {
    super({ store: new InMemoryStore() });
  }
}
