import { constants } from '../../constants';
import { Buffer } from 'buffer';
/**
 * Indicates the type of the given file. Applied to 'mode'.
 */
export enum FileType {
  FILE = constants.fs.S_IFREG,
  DIRECTORY = constants.fs.S_IFDIR,
  SYMLINK = constants.fs.S_IFLNK,
  SOCKET = constants.fs.S_IFSOCK,
  CHARACTER_DEVICE = constants.fs.S_IFCHR,
  BLOCK_DEVICE = constants.fs.S_IFBLK,
  FIFO = constants.fs.S_IFIFO,
  PIPE = constants.fs.S_IPIPE,
  VIRTUAL = 0xe000,
}

const FileTypeCheck = constants.fs.S_IFMT;
/**
 * Emulation of Node's `fs.Stats` object.
 *
 * Attribute descriptions are from `man 2 stat'
 * @see http://nodejs.org/api/fs.html#fs_class_fs_stats
 * @see http://man7.org/linux/man-pages/man2/stat.2.html
 */
export default class Stats {
  public static fromBuffer(buffer: Buffer): Stats {
    const size = buffer.readUInt32LE(0),
      mode = buffer.readUInt32LE(4),
      atime = buffer.readDoubleLE(8),
      mtime = buffer.readDoubleLE(16),
      ctime = buffer.readDoubleLE(24);

    return new Stats(s.itemType, size, mode & 0xfff, atime, mtime, ctime);
  }

  /**
   * Clones the stats object.
   */
  public static clone(s: Stats): Stats {
    return new Stats(
      s.itemType,
      s.size,
      s.mode & 0xfff,
      s.atimeMs,
      s.mtimeMs,
      s.ctimeMs,
      s.birthtimeMs,
    );
  }

  public blocks: number;
  public mode: number;
  /**
   * UNSUPPORTED ATTRIBUTES
   * I assume no one is going to need these details, although we could fake
   * appropriate values if need be.
   */
  public fileData: Buffer;
  // ID of device containing file
  public dev: number = 0;
  // inode number
  public ino: number = 0;
  // device ID (if special file)
  public rdev: number = 0;
  // number of hard links
  public nlink: number = 1;
  // blocksize for file system I/O
  public blksize: number = 4096;
  // @todo Maybe support these? atm, it's a one-user filesystem.
  // user ID of owner
  public uid: number = 0;
  // group ID of owner
  public gid: number = 0;
  // XXX: Some file systems stash data on stats objects.
  public filedata: Uint8Array | null = null;
  public atimeMs: number;
  public mtimeMs: number;
  public ctimeMs: number;
  public birthtimeMs: number;
  public size: number;

  public get atime(): Date {
    return new Date(this.atimeMs);
  }

  public get mtime(): Date {
    return new Date(this.mtimeMs);
  }

  public get ctime(): Date {
    return new Date(this.ctimeMs);
  }

  public get birthtime(): Date {
    return new Date(this.birthtimeMs);
  }

  toJSON() {
    return {
      dev: this.dev,
      ino: this.ino,
      mode: this.mode,
      nlink: this.nlink,
      uid: this.uid,
      gid: this.gid,
      rdev: this.rdev,
      size: this.size,
      blksize: this.blksize,
      blocks: this.blocks,
      atime: this.atimeMs,
      mtime: this.mtimeMs,
      ctime: this.ctimeMs,
      birthtime: this.birthtimeMs,
      isFile: this.isFile,
      isDirectory: this.isDirectory,
      isSymbolicLink: this.isSymbolicLink,
    };
  }

  /**
   * Provides information about a particular entry in the file system.
   * @param itemType Type of the item (FILE, DIRECTORY, SYMLINK, or SOCKET)
   * @param size Size of the item in bytes. For directories/symlinks,
   *   this is normally the size of the struct that represents the item.
   * @param mode Unix-style file mode (e.g. 0o644)
   * @param atimeMs time of last access, in milliseconds since epoch
   * @param mtimeMs time of last modification, in milliseconds since epoch
   * @param ctimeMs time of last time file status was changed, in milliseconds since epoch
   * @param birthtimeMs time of file creation, in milliseconds since epoch
   */
  constructor(
    public itemType: FileType,
    size: number,
    mode?: number,
    atimeMs?: number,
    mtimeMs?: number,
    ctimeMs?: number,
    birthtimeMs?: number,
  ) {
    this.size = size;
    let currentTime = 0;
    if (typeof atimeMs !== 'number') {
      currentTime = Date.now();
      atimeMs = currentTime;
    }
    if (typeof mtimeMs !== 'number') {
      if (!currentTime) {
        currentTime = Date.now();
      }
      mtimeMs = currentTime;
    }
    if (typeof ctimeMs !== 'number') {
      if (!currentTime) {
        currentTime = Date.now();
      }
      ctimeMs = currentTime;
    }
    if (typeof birthtimeMs !== 'number') {
      if (!currentTime) {
        currentTime = Date.now();
      }
      birthtimeMs = currentTime;
    }
    this.atimeMs = atimeMs;
    this.ctimeMs = ctimeMs;
    this.mtimeMs = mtimeMs;
    this.birthtimeMs = birthtimeMs;

    if (!mode) {
      switch (itemType) {
        case FileType.FILE:
          this.mode = FileType.FILE;
          break;
        case FileType.DIRECTORY:
          this.mode = FileType.DIRECTORY;
        default:
          this.mode = FileType.DIRECTORY;
      }
    } else {
      this.mode = mode;
    }
    // number of 512B blocks allocated
    this.blocks = Math.ceil(size / 512);
    // Check if mode also includes top-most bits, which indicate the file's
    // type.
    if (this.mode < 0x1000) {
      this.mode |= itemType;
    }
  }

  public toBuffer(): Uint8Array {
    const buffer = Buffer.alloc(32);
    buffer.writeUInt32LE(this.size, 0);
    buffer.writeUInt32LE(this.mode, 4);
    buffer.writeDoubleLE(this.atime.getTime(), 8);
    buffer.writeDoubleLE(this.mtime.getTime(), 16);
    buffer.writeDoubleLE(this.ctime.getTime(), 24);
    return buffer;
  }

  /**
   * @return [Boolean] True if this item is a file.
   */
  get isFile(): boolean {
    return this.itemType === FileType.FILE;
  }

  /**
   * @return [Boolean] True if this item is a directory.
   */
  get isDirectory(): boolean {
    return this.itemType === FileType.DIRECTORY;
  }

  /**
   * @return [Boolean] True if this item is a symbolic link (only valid through lstat)
   */
  get isSymbolicLink(): boolean {
    return this.itemType === FileType.SYMLINK;
  }

  /**
   * Change the mode of the file. We use this helper function to prevent messing
   * up the type of the file, which is encoded in mode.
   */
  public chmod(mode: number): void {
    this.mode = this.mode | mode;
  }

  // We don't support the following types of files.

  public isSocket(): boolean {
    return (this.mode & FileTypeCheck) === FileType.SOCKET;
  }

  public isBlockDevice(): boolean {
    return (this.mode & FileTypeCheck) === FileType.BLOCK_DEVICE;
  }

  public isCharacterDevice(): boolean {
    return (this.mode & FileTypeCheck) === FileType.CHARACTER_DEVICE;
  }

  public isFIFO(): boolean {
    return (this.mode & FileTypeCheck) === FileType.FIFO;
  }
}
