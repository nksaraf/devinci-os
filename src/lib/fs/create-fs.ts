import type { FileSystem, FileSystemConstructor } from './core/file_system';
import MountableFileSystem from './backend/MountableFileSystem';
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
  [mountPoint: string]: FileSystem;
}) {
  let mountFS = await createFileSystemBackend(MountableFileSystem, mountPoints);

  return mountFS;
}
