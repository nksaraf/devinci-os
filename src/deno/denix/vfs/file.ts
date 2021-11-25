import { ApiError } from '../../../kernel/fs/core/api_error';
import './file-access.d.ts';

export enum EntryKind {
  file = 'file',
  directory = 'directory',
  symlink = 'symlink',
}

export class BaseEntry {
  // A valid file name is a string that is not an empty string, is not equal to "." or "..", and does not contain '/' or any other character used as path separator on the underlying platform.
  constructor(public url: URL, public name: string | undefined, public type: EntryKind) {}

  get isFile(): boolean {
    return this.type === EntryKind.file;
  }
  get isSymlink(): boolean {
    return this.type === EntryKind.symlink;
  }
  get isDirectory(): boolean {
    return this.type === EntryKind.directory;
  }
}

export class FileEntry extends BaseEntry implements Deno.FileInfo {
  // A valid file name is a string that is not an empty string, is not equal to "." or "..", and does not contain '/' or any other character used as path separator on the underlying platform.
  constructor(url: URL, name: string | undefined, existingData?: ArrayBuffer) {
    super(url, name, EntryKind.file);
    this.write(existingData ?? new Uint8Array(0));
  }

  get mtime(): Date {
    return new Date(this.lastModified);
  }

  atime: Date;
  birthtime: Date;

  // available on linux only
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  blksize: number;
  blocks: number;

  async read(): Promise<ArrayBuffer> {
    return this._data;
  }

  getBufferSync(): ArrayBuffer {
    return this._data;
  }

  _data: ArrayBuffer;

  async write(buffer: ArrayBuffer) {
    this._data = buffer;
    this.lastModified = Date.now();
  }

  writeSync(buffer: ArrayBuffer) {
    this._data = buffer;
    this.lastModified = Date.now();
  }

  created: number = Date.now();
  lastModified: number;

  get size() {
    return this._data.byteLength;
  }
}

export class DirectoryEntry extends BaseEntry {
  children: { [name: string]: FileEntry | DirectoryEntry };
  constructor(public url: URL, public name: string) {
    super(url, name, EntryKind.directory);
    this.children = {};
  }
}

export interface DirectoryHandle extends EventTarget {}

function createWritableStream(handle: FileHandle, existingBuffer?: ArrayBuffer) {
  let entry = handle.entry;
  let buffer = new ArrayBuffer(existingBuffer ? existingBuffer.byteLength : 0);
  let seekOffset = buffer.byteLength;
  if (existingBuffer) {
    new Uint8Array(buffer).set(new Uint8Array(existingBuffer), 0);
  }

  let stream = new WritableStream({
    write(chunk) {
      console.log(chunk);
      let params;
      if (chunk instanceof ArrayBuffer || chunk instanceof Uint8Array || Array.isArray(chunk)) {
        params = {
          type: 'write',
          data: new Uint8Array(chunk),
        };
      } else if (typeof chunk === 'object' && chunk.type) {
        params = chunk;
      } else if (typeof chunk === 'string') {
        params = {
          type: 'write',
          data: new TextEncoder().encode(chunk),
        };
      }

      switch (params.type) {
        case 'write': {
          let data = params.data;
          if (!data) {
            throw new TypeError('Invalid data passed to write');
          }

          let writePosition = seekOffset;

          if (params.position !== undefined) {
            writePosition = params.position;
          }

          let oldSize = buffer.byteLength;

          if (writePosition + data.length > oldSize) {
            let newBuffer = new ArrayBuffer(writePosition + data.length);
            new Uint8Array(newBuffer).set(new Uint8Array(buffer), 0);
            buffer = newBuffer;
          }

          new Uint8Array(buffer).set(data, writePosition);
          seekOffset = writePosition + data.length;
          break;
        }
        case 'seek': {
          if (params.position === undefined) {
            throw new TypeError('Invalid seek position');
          }

          seekOffset = params.position;
          break;
        }
        case 'truncate': {
          if (params.size === undefined) {
            throw new TypeError('Invalid truncate size');
          }

          let newSize = params.size;
          let oldBuffer = buffer;
          let oldSize = oldBuffer.byteLength;

          if (newSize !== oldSize) {
            let newBuffer = new ArrayBuffer(newSize);
            new Uint8Array(newBuffer).set(
              new Uint8Array(buffer, 0, newSize > oldSize ? oldSize : newSize),
              0,
            );
            buffer = newBuffer;
            seekOffset = newSize;
          }
        }
      }
    },
    async close() {
      if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        throw ApiError.EACCES('File is not writable');
      }

      await entry.write(buffer);
    },
  });

  return Object.assign(stream, {
    async write(data: FileSystemWriteChunkType): Promise<void> {
      let writer = stream.getWriter();
      await writer.write(data);
      writer.releaseLock();
    },

    async seek(position: number): Promise<void> {
      let writer = stream.getWriter();
      await writer.write({
        type: 'seek',
        position,
      });
      writer.releaseLock();
    },

    async truncate(size: number): Promise<void> {
      let writer = stream.getWriter();
      await writer.write({
        type: 'truncate',
        size,
      });
      writer.releaseLock();
    },
  });
}

export class FileHandle implements FileSystemFileHandle {
  kind = 'file' as const;
  contentType: string = 'text/plain';
  lastModified: Date;

  constructor(public entry: FileEntry, public options: Deno.OpenOptions) {}

  async getData(): Promise<[ArrayBuffer]> {
    return [await this.entry.read()];
  }

  // Web API
  async getFile(): Promise<File> {
    let file = new File(await this.getData(), this.entry.name, {
      type: this.contentType,
      lastModified: this.entry.lastModified,
    });
    return Object.assign(file, {
      filePath: this.entry.name,
    });
  }

  // Web API
  async createWritable(
    options: FileSystemCreateWritableOptions = {
      keepExistingData: false,
    },
  ): Promise<FileSystemWritableFileStream> {
    if ((await this.queryPermission({ mode: 'readwrite' })) === 'denied') {
      throw ApiError.EACCES('');
    }

    let existingBuffer;
    if (options.keepExistingData) {
      existingBuffer = await this.entry.read();
    }

    return createWritableStream(this, existingBuffer);
  }

  get name() {
    return this.entry.name;
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return other.kind === 'file' && (other as FileHandle).entry.url === this.entry.url;
  }

  async queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState> {
    switch (descriptor.mode) {
      case 'read': {
        return this.options.read ? 'granted' : 'denied';
      }
      case 'readwrite': {
        return this.options.write ? 'granted' : 'denied';
      }
    }
  }

  async requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState> {
    switch (descriptor.mode) {
      case 'read': {
        this.options.read = true;
        return this.options.read ? 'granted' : 'denied';
      }
      case 'readwrite': {
        this.options.write = true;
        return this.options.write ? 'granted' : 'denied';
      }
    }
  }

  async close() {
    // noop
  }
}

export async function testFS() {
  const fileEntry = new FileEntry(new URL('test.txt', 'file://'), 'test.txt');
  fileEntry.writeSync(new TextEncoder().encode('Hello World'));

  let handle = new FileHandle(fileEntry, {
    read: true,
    write: true,
  });

  let file = await handle.getFile();
  console.log('FILEEEE', await file.text());

  let stream = await handle.createWritable();

  await stream.write('hello nikhil');
  await stream.close();

  file = await handle.getFile();
  console.log('FILEEEE', await file.text());

  stream = await handle.createWritable();

  await stream.write('hello nikhil');
  await stream.write('hello nikhil again');
  await stream.close();

  for await (let chunk of iterate((await handle.getFile()).stream())) {
    console.log(chunk);
  }

  stream = await handle.createWritable({
    keepExistingData: true,
  });

  await stream.seek(2);
  await stream.write('another one');
  await stream.close();

  file = await handle.getFile();
  console.log('FILEEEE', await file.text());

  stream = await handle.createWritable({
    keepExistingData: true,
  });

  await stream.truncate(2);
  await stream.close();

  file = await handle.getFile();
  console.log('FILEEEE', await file.text(), await file.arrayBuffer());

  let fetchStream = await fetch('/node/index.json', {}).then((res) => res.body);

  stream = await handle.createWritable({
    keepExistingData: true,
  });

  await fetchStream.pipeTo(stream, {});

  file = await handle.getFile();
  console.log('FILEEEE', await file.text(), await file.arrayBuffer());
}

async function* iterate(stream: ReadableStream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
