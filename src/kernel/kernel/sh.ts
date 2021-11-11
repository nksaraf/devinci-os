import type { Kernel } from './kernel';

declare global {
  export var kernel: Kernel;
  namespace NodeJS {
    interface Process {}
  }
}

export async function main() {
  let buffer = Buffer.from('Hello, world!\n', 'utf-8');
  kernel.process.stdout.write(buffer, 0, buffer.length, 0, console.log);
}
