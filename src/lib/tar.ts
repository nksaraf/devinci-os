import { inflate } from 'pako';
import * as path from 'path-browserify';
import { constants } from './constants';
import type { IFileSystem } from './fs/core/file_system';

export const dirname = (path: string) => {
  return path.replace(/\\/g, '/').replace(/\/[^\/]*$/, '');
};

export const extractContents = async (
  fs: IFileSystem,
  binary: Uint8Array,
  to: string,
): Promise<any> => {
  // We create the "to" directory, in case it doesn't exist
  fs.mkdirSync(to, 0o777);
  // We receive a tar.gz, we first need to uncompress it.
  // let inflatedBinary = inflate(binary);
  // Now, we get the tar contents
  let reader = new TarReader();
  let extract = await reader.readArrayBuffer(binary);
  extract.forEach((entry: any) => {
    if (entry.type === 'directory') {
      if (!fs.existsSync(path.join(to, entry.name))) {
        fs.mkdirSync(path.join(to, entry.name), 0o777);
      }
    } else {
      if (!fs.existsSync(path.join(to, entry.name))) {
        let buffer = new ArrayBuffer(entry.size);
        Buffer.from(binary).copy(
          Buffer.from(buffer),
          0,
          entry.header_offset + 512,
          entry.header_offset + 512 + entry.size,
        );
        fs.writeFileSync(
          path.join(to, entry.name),
          Buffer.from(buffer),
          'utf8',
          constants.fs.O_RDWR,
          0o777,
        );
      }
    }
    // We create the file
  });
  // extract.on('entry', function (header: any, stream: any, next: any) {
  //   let fullname = `${to}/${header.name}`;
  //   const chunks: Array<Buffer> = [];

  //   stream.on('data', (chunk: any) => chunks.push(chunk));

  //   // header is the tar header
  //   // stream is the content body (might be an empty stream)
  //   // call next when you are done with this entry

  //   stream.on('end', function () {
  //     if (header.type === 'file') {
  //       let contents = Buffer.concat(chunks);
  //       // console.debug(fullname, contents);
  //       try {
  //         fs.writeFileSync(fullname, contents, 'utf-8', 'w', 0o777);
  //       } catch (e) {
  //         // The directory is not created yet
  //         let dir = dirname(fullname);
  //         fs.mkdirSync(dir, 0o777);
  //         fs.writeFileSync(fullname, contents, 'utf-8', 'w', 0o777);
  //       }
  //     } else if (header.type === 'directory') {
  //       fs.mkdirSync(fullname, 0o777);
  //     }

  //     next(); // ready for next entry
  //   });

  //   stream.resume(); // just auto drain the stream
  // });

  // extract.on('finish', () => {
  //   resolve(extract);
  // });
  // extract.on('error', (err: any) => {
  //   reject(err);
  // });
  // extract.end();
};

class TarReader {
  fileInfo: any[];
  buffer: ArrayBuffer;
  constructor() {
    this.fileInfo = [];
  }

  // readFile(file) {
  //   return new Promise((resolve, reject) => {
  //     let reader = new FileReader();
  //     reader.onload = (event) => {
  //       this.buffer = event.target.result;
  //       this.fileInfo = [];
  //       this._readFileInfo();
  //       resolve(this.fileInfo);
  //     };
  //     reader.readAsArrayBuffer(file);
  //   });
  // }

  readArrayBuffer(
    arrayBuffer,
  ): Promise<{ header_offset: number; type: 'file' | 'directory'; name: string }[]> {
    return new Promise((resolve, reject) => {
      this.buffer = arrayBuffer;
      this.fileInfo = [];
      this._readFileInfo();
      resolve(this.fileInfo);
    });
  }

  _readFileInfo() {
    this.fileInfo = [];
    let offset = 0;
    let file_size = 0;
    let file_name = '';
    let file_type = null;

    while (offset < this.buffer.byteLength - 512) {
      file_name = this._readFileName(offset); // file name
      if (file_name.length == 0) {
        break;
      }
      file_type = this._readFileType(offset);
      file_size = this._readFileSize(offset);

      this.fileInfo.push({
        name: file_name,
        type: file_type,
        size: file_size,
        header_offset: offset,
      });

      offset += 512 + 512 * Math.trunc(file_size / 512);
      if (file_size % 512) {
        offset += 512;
      }
    }
  }

  getFileInfo() {
    return this.fileInfo;
  }

  _readString(str_offset, size) {
    return Buffer.from(this.buffer).toString('utf-8', str_offset, str_offset + size);
  }

  _readFileName(header_offset) {
    let name = this._readString(header_offset, 100);
    let nulls = name.indexOf('\0');
    if (nulls >= 0) {
      name = name.substr(0, nulls);
    }
    return name;
  }

  _readFileType(header_offset) {
    // offset: 156
    let typeStr = this._readString(header_offset + 156, 1);
    if (typeStr == '0') {
      return 'file';
    } else if (typeStr == '5') {
      return 'directory';
    } else {
      return typeStr;
    }
  }

  _readFileSize(header_offset) {
    // offset: 124
    return parseInt(this._readString(header_offset + 124, 12), 8);
  }

  _readFileBlob(file_offset, size, mimetype) {
    let view = new Uint8Array(this.buffer, file_offset, size);
    let blob = new Blob([view], { type: mimetype });
    return blob;
  }

  _readTextFile(file_offset, size) {
    return Buffer.from(this.buffer).toString('utf16le', file_offset, size);
  }

  getTextFile(file_name) {
    let i = this.fileInfo.findIndex((info) => info.name == file_name);
    if (i >= 0) {
      let info = this.fileInfo[i];
      return this._readTextFile(info.header_offset + 512, info.size);
    }
  }

  getFileBlob(file_name, mimetype) {
    let i = this.fileInfo.findIndex((info) => info.name == file_name);
    if (i >= 0) {
      let info = this.fileInfo[i];
      return this._readFileBlob(info.header_offset + 512, info.size, mimetype);
    }
  }
}

// tarball.TarWriter = class {
//   fileData: any[];
//   buffer: ArrayBuffer;
//   constructor() {
//     this.fileData = [];
//   }

//   addTextFile(name, text, opts) {
//     let buf = new ArrayBuffer(text.length);
//     let arr = new Uint8Array(buf);
//     for (let i = 0; i < text.length; i++) {
//       arr[i] = text.charCodeAt(i);
//     }
//     this.fileData.push({
//       name: name,
//       array: arr,
//       type: 'file',
//       size: arr.length,
//       dataType: 'array',
//       opts: opts,
//     });
//   }

//   addFileArrayBuffer(name, arrayBuffer, opts) {
//     let arr = new Uint8Array(arrayBuffer);
//     this.fileData.push({
//       name: name,
//       array: arr,
//       type: 'file',
//       size: arr.length,
//       dataType: 'array',
//       opts: opts,
//     });
//   }

//   addFile(name, file, opts) {
//     this.fileData.push({
//       name: name,
//       file: file,
//       size: file.size,
//       type: 'file',
//       dataType: 'file',
//       opts: opts,
//     });
//   }

//   addFolder(name, opts) {
//     this.fileData.push({
//       name: name,
//       type: 'directory',
//       size: 0,
//       dataType: 'none',
//       opts: opts,
//     });
//   }

//   _createBuffer() {
//     let tarDataSize = 0;
//     for (let i = 0; i < this.fileData.length; i++) {
//       let size = this.fileData[i].size;
//       tarDataSize += 512 + 512 * Math.trunc(size / 512);
//       if (size % 512) {
//         tarDataSize += 512;
//       }
//     }
//     let bufSize = 10240 * Math.trunc(tarDataSize / 10240);
//     if (tarDataSize % 10240) {
//       bufSize += 10240;
//     }
//     this.buffer = new ArrayBuffer(bufSize);
//   }

//   async download(filename) {
//     let blob = await this.write();
//     let $downloadElem = document.createElement('a');
//     $downloadElem.href = URL.createObjectURL(blob);
//     $downloadElem.download = filename;
//     $downloadElem.style.display = 'none';
//     document.body.appendChild($downloadElem);
//     $downloadElem.click();
//     document.body.removeChild($downloadElem);
//   }

//   write() {
//     return new Promise((resolve, reject) => {
//       this._createBuffer();
//       let offset = 0;
//       let filesAdded = 0;
//       let onFileDataAdded = () => {
//         filesAdded++;
//         if (filesAdded === this.fileData.length) {
//           let arr = new Uint8Array(this.buffer);
//           let blob = new Blob([arr], { type: 'application/x-tar' });
//           resolve(blob);
//         }
//       };
//       for (let fileIdx = 0; fileIdx < this.fileData.length; fileIdx++) {
//         let fdata = this.fileData[fileIdx];
//         // write header
//         this._writeFileName(fdata.name, offset);
//         this._writeFileType(fdata.type, offset);
//         this._writeFileSize(fdata.size, offset);
//         this._fillHeader(offset, fdata.opts, fdata.type);
//         this._writeChecksum(offset);

//         // write file data
//         let destArray = new Uint8Array(this.buffer, offset + 512, fdata.size);
//         if (fdata.dataType === 'array') {
//           for (let byteIdx = 0; byteIdx < fdata.size; byteIdx++) {
//             destArray[byteIdx] = fdata.array[byteIdx];
//           }
//           onFileDataAdded();
//         } else if (fdata.dataType === 'file') {
//           let reader = new FileReader();

//           reader.onload = (function (outArray) {
//             let dArray = outArray;
//             return function (event) {
//               let sbuf = event.target.result;
//               let sarr = new Uint8Array(sbuf);
//               for (let bIdx = 0; bIdx < sarr.length; bIdx++) {
//                 dArray[bIdx] = sarr[bIdx];
//               }
//               onFileDataAdded();
//             };
//           })(destArray);
//           reader.readAsArrayBuffer(fdata.file);
//         } else if (fdata.type === 'directory') {
//           onFileDataAdded();
//         }

//         offset += 512 + 512 * Math.trunc(fdata.size / 512);
//         if (fdata.size % 512) {
//           offset += 512;
//         }
//       }
//     });
//   }

//   _writeString(str, offset, size) {
//     let strView = new Uint8Array(this.buffer, offset, size);
//     for (let i = 0; i < size; i++) {
//       if (i < str.length) {
//         strView[i] = str.charCodeAt(i);
//       } else {
//         strView[i] = 0;
//       }
//     }
//   }

//   _writeFileName(name, header_offset) {
//     // offset: 0
//     this._writeString(name, header_offset, 100);
//   }

//   _writeFileType(typeStr, header_offset) {
//     // offset: 156
//     let typeChar = '0';
//     if (typeStr === 'file') {
//       typeChar = '0';
//     } else if (typeStr === 'directory') {
//       typeChar = '5';
//     }
//     let typeView = new Uint8Array(this.buffer, header_offset + 156, 1);
//     typeView[0] = typeChar.charCodeAt(0);
//   }

//   _writeFileSize(size, header_offset) {
//     // offset: 124
//     let sz = size.toString(8);
//     sz = this._leftPad(sz, 11);
//     this._writeString(sz, header_offset + 124, 12);
//   }

//   _leftPad(number, targetLength) {
//     let output = number + '';
//     while (output.length < targetLength) {
//       output = '0' + output;
//     }
//     return output;
//   }

//   _writeFileMode(mode, header_offset) {
//     // offset: 100
//     this._writeString(this._leftPad(mode, 7), header_offset + 100, 8);
//   }

//   _writeFileUid(uid, header_offset) {
//     // offset: 108
//     this._writeString(this._leftPad(uid, 7), header_offset + 108, 8);
//   }

//   _writeFileGid(gid, header_offset) {
//     // offset: 116
//     this._writeString(this._leftPad(gid, 7), header_offset + 116, 8);
//   }

//   _writeFileMtime(mtime, header_offset) {
//     // offset: 136
//     this._writeString(this._leftPad(mtime, 11), header_offset + 136, 12);
//   }

//   _writeFileUser(user, header_offset) {
//     // offset: 265
//     this._writeString(user, header_offset + 265, 32);
//   }

//   _writeFileGroup(group, header_offset) {
//     // offset: 297
//     this._writeString(group, header_offset + 297, 32);
//   }

//   _writeChecksum(header_offset) {
//     // offset: 148
//     this._writeString('        ', header_offset + 148, 8); // first fill with spaces

//     // add up header bytes
//     let header = new Uint8Array(this.buffer, header_offset, 512);
//     let chksum = 0;
//     for (let i = 0; i < 512; i++) {
//       chksum += header[i];
//     }
//     this._writeString(chksum.toString(8), header_offset + 148, 8);
//   }

//   _getOpt(opts, opname, defaultVal) {
//     if (opts != null) {
//       if (opts[opname] != null) {
//         return opts[opname];
//       }
//     }
//     return defaultVal;
//   }

//   _fillHeader(header_offset, opts, fileType) {
//     let uid = this._getOpt(opts, 'uid', 1000);
//     let gid = this._getOpt(opts, 'gid', 1000);
//     let mode = this._getOpt(opts, 'mode', fileType === 'file' ? '664' : '775');
//     let mtime = this._getOpt(opts, 'mtime', Date.now());
//     let user = this._getOpt(opts, 'user', 'tarballjs');
//     let group = this._getOpt(opts, 'group', 'tarballjs');

//     this._writeFileMode(mode, header_offset);
//     this._writeFileUid(uid.toString(8), header_offset);
//     this._writeFileGid(gid.toString(8), header_offset);
//     this._writeFileMtime(Math.trunc(mtime / 1000).toString(8), header_offset);

//     this._writeString('ustar', header_offset + 257, 6); // magic string
//     this._writeString('00', header_offset + 263, 2); // magic version

//     this._writeFileUser(user, header_offset);
//     this._writeFileGroup(group, header_offset);
//   }
// };
