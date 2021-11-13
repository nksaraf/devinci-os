import type { Kernel } from './kernel';
import { TTY } from './tty';

declare global {
  export var kernel: Kernel;
  namespace NodeJS {
    interface Process {}
  }
}

export async function main() {
  while (true) {
    // tty.('> ');
    await kernel.process.stdout.writeString('> ');
    let input = await kernel.process.stdin.readString();
    console.log(input);
    await kernel.process.stdout.writeString('hello workd: ' + input + '\r\n');
  }
}
