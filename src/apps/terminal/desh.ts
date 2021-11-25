import type { Remote } from 'comlink';
import type { DenoIsolate } from 'os/deno/deno';
import type { TTY } from 'os/kernel/kernel/tty';
import { Shell } from 'os/kernel/shell/shell';
import { fetchCommandFromWAPM } from './wapm';

export class DenoREPL extends Shell {
  constructor(tty: TTY, public worker: Remote<DenoIsolate>) {
    super(tty);
  }

  async handleCommand(cmd: string) {
    try {
      this.tty.println(await this.worker.eval(cmd));
    } catch (e) {
      this.tty.println(e.message + '\n' + e.stack);
    }
  }
}

export class Desh extends Shell {
  constructor(tty: TTY, public worker: Remote<DenoIsolate>) {
    super(tty);
  }

  async handleCommand(cmd: string) {
    console.log(await WebAssembly.instantiate(await fetchCommandFromWAPM('exa'), {
      
    }));
    try {
      this.tty.println(await this.worker.eval(cmd));
    } catch (e) {
      this.tty.println(e.message + '\n' + e.stack);
    }
  }
}
