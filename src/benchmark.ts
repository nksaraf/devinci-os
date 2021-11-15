let id = 0;
const util = require('util');

const bench = {
  start() {
    return console.time(`benchmarking for ${++id}`);
  },
  end() {
    return console.timeEnd(`benchmarking for ${id - 1}`);
  },
};

function main({ dur, len, type }) {
  const { TCP, TCPConnectWrap, constants: TCPConstants } = internalBinding('tcp_wrap');
  const { WriteWrap } = internalBinding('stream_wrap');
  const PORT = 0;

  const serverHandle = new TCP(TCPConstants.SERVER);
  let err = serverHandle.bind('127.0.0.1', PORT);
  if (err) fail(err, 'bind');

  err = serverHandle.listen(511);
  if (err) fail(err, 'listen');

  serverHandle.onconnection = function (err, clientHandle) {
    if (err) fail(err, 'connect');

    // The meat of the benchmark is right here:
    bench.start();
    let bytes = 0;

    setTimeout(() => {
      // report in Gb/sec
      bench.end((bytes * 8) / (1024 * 1024 * 1024));
      process.exit(0);
    }, dur * 1000);

    clientHandle.onread = function (buffer) {
      // We're not expecting to ever get an EOF from the client.
      // Just lots of data forever.
      if (!buffer) fail('read');

      // Don't slice the buffer. The point of this is to isolate, not
      // simulate real traffic.
      bytes += buffer.byteLength;
    };

    clientHandle.readStart();
  };

  client(type, len);

  function fail(err, syscall) {
    throw util._errnoException(err, syscall);
  }

  function client(type, len) {
    let chunk;
    switch (type) {
      case 'buf':
        chunk = Buffer.alloc(len, 'x');
        break;
      case 'utf':
        chunk = 'ü'.repeat(len / 2);
        break;
      case 'asc':
        chunk = 'x'.repeat(len);
        break;
      default:
        throw new Error(`invalid type: ${type}`);
    }

    const clientHandle = new TCP(TCPConstants.SOCKET);
    const connectReq = new TCPConnectWrap();
    const err = clientHandle.connect(connectReq, '127.0.0.1', PORT);

    if (err) fail(err, 'connect');

    clientHandle.readStart();

    connectReq.oncomplete = function (err) {
      if (err) fail(err, 'connect');

      while (clientHandle.writeQueueSize === 0) write();
    };

    function write() {
      const writeReq = new WriteWrap();
      writeReq.oncomplete = afterWrite;
      let err;
      switch (type) {
        case 'buf':
          err = clientHandle.writeBuffer(writeReq, chunk);
          break;
        case 'utf':
          err = clientHandle.writeUtf8String(writeReq, chunk);
          break;
        case 'asc':
          err = clientHandle.writeAsciiString(writeReq, chunk);
          break;
      }

      if (err) fail(err, 'write');
    }

    function afterWrite(err, handle) {
      if (err) fail(err, 'write');

      while (clientHandle.writeQueueSize === 0) write();
    }
  }
}

module.exports = { main };
