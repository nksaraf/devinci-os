import CommandOptions from './command-options';

export default class Command {
  options: CommandOptions;

  constructor(options: CommandOptions) {
    this.options = options;
  }
  async run(fs: FileSystem) {
    throw new Error('run not implemented by the Command subclass');
  }
}
