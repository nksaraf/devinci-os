import type { Remote } from '$lib/comlink/mod';
import type { DenoIsolate } from '$lib/deno/isolate';
import type { TTY } from 'os/lib/shell/ttyhell/tty';
import { LineDiscipline } from 'os/lib/tty/line_discipline';
import { fetchCommandFromWAPM, getWAPMUrlForCommandName } from './wapm';

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
