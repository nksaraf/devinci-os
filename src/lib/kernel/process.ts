export enum ProcessState {
  Starting,
  Running,
  Interruptable,
  Zombie,
}
export class Process {
  cwd: string;
  env: { [key: string]: string };
  argv: string[];
  stdin: TTYFile;
  stdout: TTYFile;
  stderr: TTYFile;
  chdir(path: string): void {
    this.cwd = path;
  }
  files: { [key: number]: File };
  constructor() {
    
  }
}