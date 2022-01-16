import { MonacoWorker, initialize, IWorkerContext, importScript } from '../../worker.ts';

export class PrettierWorker extends MonacoWorker<{ parser: string; plugins: string[] }> {
  loader: Promise<any>;
  plugins: any[] = [];
  prettier: any = {};
  constructor(ctx: IWorkerContext<undefined>, config: { parser: string; plugins: string[] }) {
    super(ctx, config);
    this.options = config;
    this.loader = this.importPrettier();
  }

  async importPrettier() {
    await importScript('https://unpkg.com/prettier@2.0.4/standalone.js');
    // @ts-ignore
    this.prettier = prettier;
    for (var plugin of this.options.plugins) {
      // this.plugins.push(
      await importScript(`https://unpkg.com/prettier@2.0.4/${plugin}.js`);
      // );
    }
    // @ts-ignore
    this.plugins = prettierPlugins;
  }

  provideDocumentFormattingEdits: MonacoWorker['provideDocumentFormattingEdits'] = async (
    model,
  ) => {
    const { plugins, ...options } = this.options;
    console.debug(`[prettier] formatting`);

    const text = this.prettier.format(model.getValue(), {
      plugins: this.plugins,
      singleQuote: true,
      ...options,
    });

    const lines = text.split('\n');
    const formattedFulLRange = {
      startLineNumber: 1,
      endLineNumber: lines.length,
      startColumn: 0,
      endColumn: lines[lines.length - 1].length,
    };

    const originalFullRange = model.getFullModelRange();

    return [
      {
        range:
          originalFullRange.endLineNumber > formattedFulLRange.endLineNumber ||
          (originalFullRange.endLineNumber === formattedFulLRange.endLineNumber &&
            originalFullRange.endColumn > formattedFulLRange.endColumn)
            ? originalFullRange
            : formattedFulLRange,
        text,
      },
    ];
  };
}
