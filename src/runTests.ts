import type { NodeHost } from './kernel/node/runtime';

export function runTests(node: NodeHost) {
  node.runTest('fs-open');
  // node.runTest('assert');
  node.runTest('assert-if-error');
  // node.runTest('assert-first-line');
  node.runTest('buffer-read');
  node.runTest('buffer-bigint64');
  node.runTest('buffer-bytelength');
  // node.runTest('buffer-fill');
  // node.runTest('buffer-fill');
  // node.runTest('buffer-fill');
  // node.runTest('path-resolve');
  node.runTest('path-basename');
  node.runTest('path-dirname');
  node.runTest('path-extname');
  node.runTest('path-isabsolute');
  node.runTest('path-join');
  node.runTest('path-parse-format');
  node.runTest('path-posix-exists');
  node.runTest('path-posix-relative-on-windows');
  node.runTest('path-relative');
  node.runTest('path-resolve');
  node.runTest('path-win32-exists');
  node.runTest('path-zero-length-strings');
  node.runTest('path');
  // node.runTest('fs-read');
  // node.runTest('util-types');
  // node.runTest('fs-readfile');
}
