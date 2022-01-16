import type { FileSystemOptions, IFileSystem } from './core/file_system.ts';
import MountableFileSystem from './mountable.ts';

export class VirtualFileSystem extends MountableFileSystem {
  constructor(rootFS: IFileSystem) {
    super(rootFS);
  }

  public static readonly Name = 'VirtualFileSystem';

  public static readonly Options: FileSystemOptions = {};
}
