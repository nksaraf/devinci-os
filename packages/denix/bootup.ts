// import { createLocalNetwork } from './lib/service-worker.ts';
navigator.userAgent = '';
const { ProcessManager } = await import('./proc_manager.ts');

export const processManager = new ProcessManager();
// await createLocalNetwork(processManager);

await processManager.start();

console.log(processManager);
// console.log('here');
