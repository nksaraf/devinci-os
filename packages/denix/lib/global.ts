/**
 * Exports the global scope variable.
 * In the main browser thread, this is "window".
 * In a WebWorker, this is "self".
 * In Node, this is "global".
 * @hidden
 * @private
 */
declare var global: any;
/**
 * @hidden
 */
export const Global: any =
  typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : global;
export default Global;
