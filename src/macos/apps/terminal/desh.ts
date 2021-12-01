import type { Remote } from '$lib/comlink/protocol.ts';
import type { DenoIsolate } from '$lib/denix/isolate.ts';
import type { TTY } from '$lib/tty.ts';
import { LineDiscipline } from '$lib/shell/shell.ts';
import { fetchCommandFromWAPM, getWAPMUrlForCommandName } from './wapm.ts';

export class DenoREPL extends LineDiscipline {
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

export class Desh extends LineDiscipline {
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
