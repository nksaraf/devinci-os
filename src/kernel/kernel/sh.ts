import type { Kernel } from './kernel';
import type { Process as OSProcess } from './proc';

declare global {
  export var kernel: OSProcess;
  namespace NodeJS {
    interface Process {
    
    }
  }
}

export async function main() {
  kernel.stdout.write(Buffer.from('Hello, world!\n', 'utf-8'));
}
