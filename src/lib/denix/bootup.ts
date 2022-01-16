import { createLocalNetwork } from '$lib/service-worker';
await createLocalNetwork();
import { ProcessManager } from './proc_manager';

export const processManager = new ProcessManager();

await processManager.start();
