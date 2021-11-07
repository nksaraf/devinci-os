import mitt from 'mitt';
import './index';
import type { FileSystem } from './core/file_system';
import InMemoryFileSystem from './backend/InMemory';
import NodeFileSystem from './node/FS';

function createFileSystem() {
  let fsEvents = mitt();
  let nodeFS: NodeFileSystem;

  InMemoryFileSystem.Create({}, (err, memFS) => {
    window._fs = memFS;
    nodeFS = new NodeFileSystem();
    (nodeFS as NodeFileSystem).initialize(memFS);
    window.fs = nodeFS;
  });

  nodeFS.events = fsEvents;

  return nodeFS;
}

declare global {
  interface Window {
    fs: NodeFileSystem;
    _fs: FileSystem;
  }
}

export default createFileSystem();
