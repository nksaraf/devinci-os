import type { CallbackTwoArgs, FileSystemConstructor, FileSystemOptions } from './core/file_system';
import MountableFileSystem from './backend/MountableFileSystem';
import type { MountableFileSystemOptions } from './backend/MountableFileSystem';
import mitt from 'mitt';

type Args<T extends FileSystemConstructor> = Parameters<T['Create']>;
type CallbackType<T extends FileSystemConstructor> = Args<T>[1];
type System<T extends FileSystemConstructor> = Parameters<CallbackType<T>>[1];

export function createFileSystemBackend<T extends FileSystemConstructor>(
  backend: T,
  options: any,
): Promise<System<T>> {
  return new Promise<System<T>>((resolve, reject) =>
    backend.Create(options, (err, fileSystemBackend) => {
      if (err) {
        reject(err);
      } else {
        resolve(fileSystemBackend);
      }
    }),
  );
}

export let events = mitt();

export class FileSystem extends MountableFileSystem {
  constructor(opts: any) {
    super(opts);
  }

  event: typeof events;

  public static readonly Name = 'MountableFileSystem';

  public static readonly Options: FileSystemOptions = {};

  /**
   * Creates a MountableFileSystem instance with the given options.
   */
  public static Create(
    opts: MountableFileSystemOptions,
    cb: CallbackTwoArgs<FileSystem>,
  ): FileSystem {
    let fs;
    MountableFileSystem.Create({}, (e, imfs?) => {
      if (imfs) {
        fs = new FileSystem(imfs);
        try {
          Object.keys(opts).forEach((mountPoint: string) => {
            fs.mount(mountPoint, opts[mountPoint]);
          });
        } catch (e) {
          return cb(e);
        }
        cb(null, fs);
      } else {
        cb(e);
      }
    });

    if (fs === undefined) {
      throw new Error('Unable to create MountableFileSystem');
    }

    return fs;
  }
}
