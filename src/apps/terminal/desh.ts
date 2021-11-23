import type { Remote } from 'comlink';
import type { DenoIsolate } from 'os/deno/deno';
import type { TTY } from 'os/kernel/kernel/tty';
import { Shell } from 'os/kernel/shell/shell';

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
