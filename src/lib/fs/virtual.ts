import type { FileSystemConstructor, FileSystemOptions, IFileSystem } from './core/file_system';
import MountableFileSystem from './mountable';
import mitt from 'mitt';

type Args<T extends FileSystemConstructor> = Parameters<T['Create']>;
type CallbackType<T extends FileSystemConstructor> = Args<T>[1];
type System<T extends FileSystemConstructor> = Parameters<CallbackType<T>>[1];

export let events = mitt();

export class VirtualFileSystem extends MountableFileSystem {
  constructor(rootFS: IFileSystem) {
    super(rootFS);
  }

  event: typeof events;

  public static readonly Name = 'VirtualFileSystem';

  public static readonly Options: FileSystemOptions = {};
}
