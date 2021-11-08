import { default as NodeFileSystem } from './fs';
import type { FSModule } from './fs';
// Manually export the individual public functions of fs.
// Required because some code will invoke functions off of the module.
// e.g.:
// let writeFile = fs.writeFile;
// writeFile(...)

let fs = new NodeFileSystem();
// /**
//  * @hidden
//  */
// const _fsMock: FSModule = <any>{};
// /**
//  * @hidden
//  */
// const fsProto = NodeFileSystem.prototype;
// Object.keys(fsProto).forEach((key) => {
//   if (typeof fs[key] === 'function') {
//     (<any>_fsMock)[key] = function () {
//       return (<Function>fs[key]).apply(fs, arguments);
//     };
//   } else {
//     (<any>_fsMock)[key] = fs[key];
//   }
// });

// _fsMock['changeFSModule'] = function (newFs: NodeFileSystem): void {
//   fs = newFs;
// };
// _fsMock['getFSModule'] = function (): NodeFileSystem {
//   return fs;
// };
// _fsMock['fs'] = NodeFileSystem;
// _fsMock['Stats'] = NodeFileSystem.Stats;

export default fs;
