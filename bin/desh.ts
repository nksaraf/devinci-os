import { startup, runShell } from '../src/lib/desh';

if (import.meta.main) {
  await startup();
  await runShell();
}
