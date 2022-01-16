import { MonacoWorker } from './monaco-worker.ts';

import { SimpleWorkerServer } from 'monaco-editor/esm/vs/base/common/worker/simpleWorker.ts';
import { EditorSimpleWorker } from 'monaco-editor/esm/vs/editor/common/services/editorSimpleWorker.ts';

const hashCode = function (s: string) {
  var hash = 0;
  if (s.length == 0) {
    return hash;
  }
  for (var i = 0; i < s.length; i++) {
    var char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

export * from './monaco-worker.ts';

export const importScript = async (src: string) => {
  const _this = self as any;
  if (_this.define) {
    return await new Promise((resolve, reject) => {
      _this.define(`${hashCode(src)}`, [src], (val: any) => {
        resolve(val);
      });
    });
  } else {
    importScripts(src);
    // throw new Error('Not on AMD');
  }
};

var initialized = false;

export function initialize(name: string, WorkerClass: typeof MonacoWorker) {
  if (initialized) {
    return;
  }
  initialized = true;
  var simpleWorker = new SimpleWorkerServer(
    function (msg) {
      //@ts-ignore
      self.postMessage(msg);
    },
    function (host) {
      return new EditorSimpleWorker(host, (ctx, options) => {
        return new WorkerClass(ctx, options);
      });
    },
  );
  self.onmessage = function (e) {
    simpleWorker.onmessage(e.data);
  };
  self[name + 'MonacoWorker'] = WorkerClass;
}

// @ts-ignore
self.initialize = initialize;
// @ts-ignore
self.MonacoWorker = MonacoWorker;
