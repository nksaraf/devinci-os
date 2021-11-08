import type MountableFileSystem from '../fs/backend/MountableFileSystem';
import { createFileSystem } from '../fs/create-fs';

export class Kernel {
  static fs: MountableFileSystem;
  static path: typeof import('path');

  static async init() {
    Kernel.fs = await createFileSystem({});
  }

  static log = console.log;
}

import Global from '../global';

Global.Kernel = Kernel;
