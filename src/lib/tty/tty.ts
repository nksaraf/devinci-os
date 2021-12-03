import type { File } from '../fs/core/file';
import VirtualFile from '../fs/core/virtual_file';
import type { ActiveCharPrompt, ActivePrompt } from './utils';
import { InMemoryPipe } from '../pipe';
import { constants } from '../constants';
import { Buffer } from 'buffer';
import { LineDiscipline } from './line_discipline';
import { newPromise } from '../promise';

export interface IDisposable {
  dispose(): void;
}

export const MOBILE_KEYBOARD_EVENTS = ['click', 'tap'];
/**
 * Convert offset at the given input to col/row location
 *
 * This function is not optimized and practically emulates via brute-force
 * the navigation on the terminal, wrapping when they reach the column width.
 */
export function offsetToColRow(input: string, offset: number, maxCols: number) {
  let row = 0;
  let col = 0;

  for (let i = 0; i < offset; ++i) {
    const chr = input.charAt(i);
    if (chr === '\n') {
      col = 0;
      row += 1;
    } else {
      col += 1;
      if (col > maxCols) {
        col = 0;
        row += 1;
      }
    }
  }

  return { row, col };
}

/**
 * Counts the lines in the given input
 */
export function countLines(input: string, maxCols: number) {
  return offsetToColRow(input, input.length, maxCols).row + 1;
}

type AutoCompleteHandler = (index: number, tokens: string[]) => string[];

let keyboard = {
  UP_ARROW: 1,
  DOWN_ARROW: 2,
  LEFT_ARROW: 3,
  RIGHT_ARROW: 4,
  HOME: 5,
  END: 6,
  PAGE_UP: 7,
  PAGE_DOWN: 8,
  ALT_LEFT_ARROW: 9,
  ALT_RIGHT_ARROW: 10,
  CTRL_LEFT_ARROW: 11,
  CTRL_RIGHT_ARROW: 12,
  CTRL_BACKSPACE: 13,
  DELETE: 14,
};

export interface TerminalDevice extends EventTarget {
  write(data: any, cb?: any): void;
  get cols(): number;
  get rows(): number;
  tty: TTY;
}

//
export class TTY extends VirtualFile implements File {
  _termSize: {
    columns: number;
    rows: number;
  };

  rawMode: boolean = false;

  _firstInit: boolean = true;
  _cursor: number;
  _input: string;
  _promptPrefix: string;
  _continuationPromptPrefix: string;

  _eventTarget = new EventTarget();

  // _active: boolean = true;
  // _activePrompt;
  // _autocompleteHandlers: any;
  // maxAutocompleteEntries: number;
  // commandRunner: any;

  // inputStartCursor: number;

  public device: TerminalDevice;

  constructor(path) {
    super(path,);
    this._flag = constants.fs.O_RDWR;

    this._termSize = {
      columns: 100,
      rows: 80,
    };
    this._promptPrefix = '';
    this._continuationPromptPrefix = '';
    this._input = '';
    this._cursor = 0;
    this.lineDiscipline = new LineDiscipline(this, {
      historySize: 10,
      maxAutocompleteEntries: 10,
    });
  }

  connect(device: TerminalDevice) {
    this.device = device;
    this._termSize = {
      columns: this.device.cols,
      rows: this.device.rows,
    };

    device.tty = this;

    this.device.addEventListener('data', (dat: CustomEvent) => {
      console.log(this.rawMode);
      if (this.rawMode) {
        let buf = Buffer.from(dat.detail, 'utf-8');
        this.pipe.writeBuffer(buf, 0, buf.length, null).then(() => {
          console.log('wrritten line', dat.detail);
        });
      } else {
        console.log(dat);
        this.lineDiscipline.handleTermData(dat.detail);
      }
    });
  }

  lineDiscipline: LineDiscipline;

  setRawMode(rawMode: boolean) {
    console.log('setting raw mode');
    this.rawMode = rawMode;
  }

  /**
   * Handle input completion
   */
  handleLineComplete = (line) => {
    let buf = Buffer.from(line, 'utf-8');
    this.pipe.writeBuffer(buf, 0, buf.length, null).then(() => {
      console.log('wrritten line', line);
    });

    this.setInput('');
  };

  /**
   * Insert character at cursor location
   */
  handleCursorInsert = (data: string) => {
    const newInput =
      this.getInput().substring(0, this.getCursor()) +
      data +
      this.getInput().substring(this.getCursor());
    this.setCursorDirectly(this.getCursor() + data.length);
    this.setInput(newInput);
  };

  /**
   * Prints a message and changes line
   */
  println(message: string) {
    this.print(message + '\n');
  }

  /**
   * Prints a message and properly handles new-lines
   */
  print(message: string, cb?: () => void) {
    const normInput = message.replace(/[\r\n]+/g, '\n').replace(/\n/g, '\r\n');

    if (this.device) {
      this.device.write(normInput, cb);
    }
    console.log(normInput);
  }

  /**
   * Prints a list of items using a wide-format
   */
  printWide(items: Array<string>, padding = 2) {
    if (items.length === 0) return this.println('');

    // Compute item sizes and matrix row/cols
    const itemWidth = items.reduce((width, item) => Math.max(width, item.length), 0) + padding;
    const wideCols = Math.floor(this._termSize.columns / itemWidth);
    const wideRows = Math.ceil(items.length / wideCols);

    // Print matrix
    let i = 0;
    for (let row = 0; row < wideRows; ++row) {
      let rowStr = '';

      // Prepare columns
      for (let col = 0; col < wideCols; ++col) {
        if (i < items.length) {
          let item = items[i++];
          item += ' '.repeat(itemWidth - item.length);
          rowStr += item;
        }
      }
      this.println(rowStr);
    }
  }

  /**
   * Function to return a deconstructed readPromise
   */
  _getAsyncRead() {
    let readResolve;
    let readReject;
    const readPromise = new Promise((resolve, reject) => {
      readResolve = (response: string) => {
        this._promptPrefix = '';
        this._continuationPromptPrefix = '';
        resolve(response);
      };
      readReject = reject;
    });

    return {
      promise: readPromise,
      resolve: readResolve,
      reject: readReject,
    };
  }

  async sync() {
    return;
  }

  /**
   * Return a promise that will resolve when the user has completed
   * typing a single line
   */
  prompt(promptPrefix: string, continuationPromptPrefix: string = '> '): ActivePrompt {
    if (promptPrefix.length > 0) {
      this.print(promptPrefix);
    }

    this._firstInit = true;
    this._promptPrefix = promptPrefix;
    this._continuationPromptPrefix = continuationPromptPrefix;
    this._input = '';
    this._cursor = 0;

    return {
      promptPrefix,
      continuationPromptPrefix,
      ...this._getAsyncRead(),
    };
  }

  /**
   * Return a promise that will be resolved when the user types a single
   * character.
   *
   * This can be active in addition to `.read()` and will be resolved in
   * priority before it.
   */
  readChar(promptPrefix: string): ActiveCharPrompt {
    if (promptPrefix.length > 0) {
      this.print(promptPrefix);
    }

    return {
      promptPrefix,
      ...this._getAsyncRead(),
    };
  }

  /**
   * Clears the current status on the line, meant to be run after printStatus
   */
  clearStatus() {
    // Restore the cursor position
    this.print('\u001b[u');
    // Clear from cursor to end of screen
    this.print('\u001b[1000D');
    this.print('\u001b[0J');
  }

  /**
   * Apply prompts to the given input
   */
  applyPrompts(input: string): string {
    return this._promptPrefix + input.replace(/\n/g, '\n' + this._continuationPromptPrefix);
  }

  /**
   * Advances the `offset` as required in order to accompany the prompt
   * additions to the input.
   */
  applyPromptOffset(input: string, offset: number): number {
    const newInput = this.applyPrompts(input.substring(0, offset));
    return newInput.length;
  }

  /**
   * Clears the current prompt
   *
   * This function will erase all the lines that display the current prompt
   * and move the cursor in the beginning of the first line of the prompt.
   */
  clearInput() {
    const currentPrompt = this.applyPrompts(this._input);

    // Get the overall number of lines to clear
    const allRows = countLines(currentPrompt, this._termSize.columns);

    // Get the line we are currently in
    const promptCursor = this.applyPromptOffset(this._input, this._cursor);
    const { col, row } = offsetToColRow(currentPrompt, promptCursor, this._termSize.columns);

    // First move on the last line
    const moveRows = allRows - row - 1;
    for (let i = 0; i < moveRows; ++i) this.device.write('\x1B[E');

    // Clear current input line(s)
    this.device.write('\r\x1B[K');
    for (let i = 1; i < allRows; ++i) this.device.write('\x1B[F\x1B[K');
  }

  /**
   * Clears the entire Tty
   *
   * This function will erase all the lines that display on the tty,
   * and move the cursor in the beginning of the first line of the prompt.
   */
  clearTty() {
    // Clear the screen
    this.device.write('\u001b[2J');
    // Set the cursor to 0, 0
    this.device.write('\u001b[0;0H');
    this._cursor = 0;
  }

  /**
   * Function to return if it is the initial read
   */
  getFirstInit(): boolean {
    return this._firstInit;
  }

  /**
   * Function to get the current Prompt prefix
   */
  getPromptPrefix(): string {
    return this._promptPrefix;
  }

  /**
   * Function to get the current Continuation Prompt prefix
   */
  getContinuationPromptPrefix(): string {
    return this._continuationPromptPrefix;
  }

  /**
   * Function to get the terminal size
   */
  getTermSize(): { rows: number; columns: number } {
    return this._termSize;
  }

  /**
   * Function to get the current input in the line
   */
  getInput(): string {
    return this._input;
  }

  /**
   * Function to get the current cursor
   */
  getCursor(): number {
    return this._cursor;
  }

  /**
   * Function to get the size (columns and rows)
   */
  getSize(): { columns: number; rows: number } {
    return this._termSize;
  }

  /**
   * Function to return the terminal buffer
   */
  async getBuffer(): Promise<Uint8Array> {
    throw new Error('Not implemented');
  }

  /**
   * Function to return the terminal buffer
   */
  getBufferSync(): Uint8Array {
    throw new Error('Not implemented');
  }

  /**
   * Replace input with the new input given
   *
   * This function clears all the lines that the current input occupies and
   * then replaces them with the new input.
   */
  setInput(newInput: string, shouldNotClearInput: boolean = false) {
    // Doing the programming anitpattern here,
    // because defaulting to true is the opposite of what
    // not passing a param means in JS
    if (!shouldNotClearInput) {
      this.clearInput();
    }

    // Write the new input lines, including the current prompt
    const newPrompt = this.applyPrompts(newInput);
    this.print(newPrompt);

    // Trim cursor overflow
    if (this._cursor > newInput.length) {
      this._cursor = newInput.length;
    }

    // Move the cursor to the appropriate row/col
    const newCursor = this.applyPromptOffset(newInput, this._cursor);
    const newLines = countLines(newPrompt, this._termSize.columns);
    const { col, row } = offsetToColRow(newPrompt, newCursor, this._termSize.columns);
    const moveUpRows = newLines - row - 1;

    this.device.write('\r');
    for (let i = 0; i < moveUpRows; ++i) this.device.write('\x1B[F');
    for (let i = 0; i < col; ++i) this.device.write('\x1B[C');

    // Replace input
    this._input = newInput;
  }

  /**
   * Set the new cursor position, as an offset on the input string
   *
   * This function:
   * - Calculates the previous and current
   */
  setCursor(newCursor: number) {
    if (newCursor < 0) newCursor = 0;
    if (newCursor > this._input.length) newCursor = this._input.length;
    this._writeCursorPosition(newCursor);
  }

  /**
   * Sets the direct cursor value. Should only be used in keystroke contexts
   */
  setCursorDirectly(newCursor: number) {
    this._writeCursorPosition(newCursor);
  }

  _writeCursorPosition(newCursor: number) {
    // Apply prompt formatting to get the visual status of the display
    const inputWithPrompt = this.applyPrompts(this._input);
    const inputLines = countLines(inputWithPrompt, this._termSize.columns);

    // Estimate previous cursor position
    const prevPromptOffset = this.applyPromptOffset(this._input, this._cursor);
    const { col: prevCol, row: prevRow } = offsetToColRow(
      inputWithPrompt,
      prevPromptOffset,
      this._termSize.columns,
    );

    // Estimate next cursor position
    const newPromptOffset = this.applyPromptOffset(this._input, newCursor);
    const { col: newCol, row: newRow } = offsetToColRow(
      inputWithPrompt,
      newPromptOffset,
      this._termSize.columns,
    );

    // Adjust vertically
    if (newRow > prevRow) {
      for (let i = prevRow; i < newRow; ++i) this.print('\x1B[B');
    } else {
      for (let i = newRow; i < prevRow; ++i) this.print('\x1B[A');
    }

    // Adjust horizontally
    if (newCol > prevCol) {
      for (let i = prevCol; i < newCol; ++i) this.print('\x1B[C');
    } else {
      for (let i = newCol; i < prevCol; ++i) this.print('\x1B[D');
    }

    // Set new offset
    this._cursor = newCursor;
  }

  setTermSize(cols: number, rows: number) {
    this._termSize = { columns: cols, rows };
  }

  setFirstInit(value: boolean) {
    this._firstInit = value;
  }

  setPromptPrefix(value: string) {
    this._promptPrefix = value;
  }

  setContinuationPromptPrefix(value: string) {
    this._continuationPromptPrefix = value;
  }

  writeSync(buffer: Uint8Array, offset: number, length: number, position: number) {
    const promise = newPromise<number>();
    this.print(new TextDecoder().decode(buffer), () => {
      promise.resolve(buffer.length);
    });

    return buffer.length;
  }

  async write(buffer: Uint8Array, offset: number, length: number, position: number) {
    const promise = newPromise<number>();
    this.print(new TextDecoder().decode(buffer), () => {
      promise.resolve(buffer.length);
    });

    return buffer.length;
  }

  async readBuffer(buffer: Buffer, offset: number, length: number, position: number) {
    console.log('readBuffer', buffer, offset, length, position);
    if (!this.rawMode && !this.lineDiscipline._active) {
      this.lineDiscipline.prompt(this._promptPrefix, this._continuationPromptPrefix);
    }

    return await this.pipe.readBuffer(buffer, offset, buffer.byteLength, position);
  }

  pipe = new InMemoryPipe();
}
