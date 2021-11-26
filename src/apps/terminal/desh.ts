import type { Remote } from 'comlink';
import type { DenoIsolate } from 'os/deno/deno';
import type { TTY } from 'os/kernel/kernel/tty';
import { Shell } from 'os/kernel/shell/shell';
import { fetchCommandFromWAPM, getWAPMUrlForCommandName } from './wapm';

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
    let args = cmd.split(' ');
    if (!args[0].endsWith('.ts')) {
      args[0] = await getWAPMUrlForCommandName(args[0]);
    }
    try {
      this.tty.println(await this.worker.run(args[0]));
    } catch (e) {
      this.tty.println(e.message + '\n' + e.stack);
    }
  }
}
