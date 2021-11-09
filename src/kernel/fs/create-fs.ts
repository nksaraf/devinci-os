import type {
  CallbackTwoArgs,
  IFileSystem,
  FileSystemConstructor,
  FileSystemOptions,
} from './core/file_system';
import MountableFileSystem, { MountableFileSystemOptions } from './backend/MountableFileSystem';
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

export async function createFileSystem(mountPoints: {
  // Locations of mount points. Can be empty.
  [mountPoint: string]: IFileSystem;
}) {
  let mountFS = await createFileSystemBackend(MountableFileSystem, mountPoints);

  return mountFS;
}

export class KernelFileSystem extends MountableFileSystem {
  constructor(opts: any) {
    super(opts);
  }

  public static readonly Name = 'MountableFileSystem';

  public static readonly Options: FileSystemOptions = {};

  /**
   * Creates a MountableFileSystem instance with the given options.
   */
  public static Create(
    opts: MountableFileSystemOptions,
    cb: CallbackTwoArgs<MountableFileSystem>,
  ): void {
    let fs;
    MountableFileSystem.Create({}, (e, imfs?) => {
      if (imfs) {
        fs = new MountableFileSystem(imfs);
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

export function createFileSystemSync(mountPoints: {
  // Locations of mount points. Can be empty.
  [mountPoint: string]: IFileSystem;
}) {
  let fs;
  // crossing our fingers that ths is synchronous
  MountableFileSystem.Create(mountPoints, (err, _fs) => {
    fs = _fs;
  });

  return fs;
}
