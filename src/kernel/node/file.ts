import * as path from 'path';
import { ApiError } from '../fs/core/api_error';
import { isReadable, isWriteable } from '../fs/core/file_flag';
import { constants } from '../kernel/constants';
import './file-access.d.ts';
import type { Resource } from '../../deno/denix/interface';

enum FileSystemHandleKind {
  file = 'file',
  directory = 'directory',
}

class FileEntry {
  async getData(): Promise<ArrayBuffer> {
    return this._data;
  }
  _data: ArrayBuffer;

  async setData(buffer: any) {
    this._data = buffer;
    this.lastModified = Date.now();
  }

  constructor(public filePath: string) {
    this.name = path.basename(filePath);
    this.setData(new ArrayBuffer(0));
  }

  lastModified: number;

  // A valid file name is a string that is not an empty string, is not equal to "." or "..", and does not contain '/' or any other character used as path separator on the underlying platform.
  name: string;

  get size() {
    return this._data.byteLength;
  }
}

class DirectoryEntry {
  children: { [name: string]: FileEntry | DirectoryEntry };
}

interface DirectoryHandle extends EventTarget {}

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
        throw ApiError.EPERM('File is not writable');
      }

      await entry.setData(buffer);
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

class FileHandle implements FileSystemFileHandle, Resource {
  kind = FileSystemHandleKind.file as const;
  async getData(): Promise<[ArrayBuffer]> {
    return [await this.entry.getData()];
  }

  async getFile(): Promise<File> {
    let file = new File(await this.getData(), 'file.txt', {
      type: 'text/plain',
      lastModified: this.entry.lastModified,
    });
    return Object.assign(file, {
      filePath: this.entry.name,
    });
  }

  constructor(public entry: FileEntry, private flag: number) {}

  read(data: Uint8Array): Promise<ReadableStream<any>> {
    let file = new File(await this.getData(), 'file.txt', {
      type: 'text/plain',
      lastModified: this.entry.lastModified,
    });
    return Object.assign(file, {
      filePath: this.entry.name,
    });
  }
  
  write(data: Uint8Array): WritableStream<any> {
    throw new Error('Method not implemented.');
  }
  
  close?(): WritableStream<any> {
    throw new Error('Method not implemented.');
  }

  async createWritable(
    options: FileSystemCreateWritableOptions = {
      keepExistingData: false,
    },
  ): Promise<FileSystemWritableFileStream> {
    if ((await this.queryPermission({ mode: 'readwrite' })) === 'denied') {
      throw ApiError.EPERM('');
    }

    let existingBuffer;
    if (options.keepExistingData) {
      existingBuffer = await this.entry.getData();
    }

    return createWritableStream(this, existingBuffer);
  }

  get name() {
    return this.entry.name;
  }

  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState> {
    switch (descriptor.mode) {
      case 'read': {
        return Promise.resolve(isReadable(this.flag) ? 'granted' : 'denied');
      }
      case 'readwrite': {
        return Promise.resolve(isWriteable(this.flag) ? 'granted' : 'denied');
      }
    }
  }

  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState> {
    switch (descriptor.mode) {
      case 'read': {
        this.flag |= constants.fs.O_RDONLY;
        return Promise.resolve(isReadable(this.flag) ? 'granted' : 'denied');
      }
      case 'readwrite': {
        this.flag |= constants.fs.O_RDWR;
        return Promise.resolve(isWriteable(this.flag) ? 'granted' : 'denied');
      }
    }
  }

  lastModified: Date;
}

export async function testFS() {
  const fileEntry = new FileEntry('test.txt');
  fileEntry.setData(new TextEncoder().encode('Hello World'));

  let handle = new FileHandle(fileEntry, constants.fs.O_RDWR);

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

  for await (let chunk of streamAsyncIterable((await handle.getFile()).stream())) {
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

  // file = await handle.getFile();
  // console.log('FILEEEE', await file.text(), await file.arrayBuffer());
}

async function* streamAsyncIterable(stream: ReadableStream) {
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
