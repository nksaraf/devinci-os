import type { IBuffer } from 'xterm';
import { Terminal } from 'xterm';
import type { File } from '../fs/core/file';
import VirtualFile from '../fs/generic/virtual_file';
import type { ActiveCharPrompt, ActivePrompt } from '../shell/shell-utils';
import { InMemoryPipe } from './pipe';
import { constants } from './constants';
import { Buffer } from 'buffer';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

export interface IDisposable {
  dispose(): void;
}

const MOBILE_KEYBOARD_EVENTS = ['click', 'tap'];
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

// export class MittEventEmitter implements IEventEmitter {
//   _events = mitt();

//   on(event: string, callback: (...args: any[]) => void) {
//     this._events.on(event, callback);

//     return {
//       dispose: () => {
//         this._events.off(event, callback);
//       },
//     };
//   }

//   emit(event: string, args: any) {
//     this._events.emit(event, args);
//   }
// }

// export class TTYDevice extends MittEventEmitter implements TerminalDevice {
//   get cols(): number {
//     return 100;
//   }
//   get rows(): number {
//     return 100;
//   }
//   write(data: string) {
//     this.emit('output', data);
//   }
//   tty: TTY;
// }

export class Xterm extends Terminal implements TerminalDevice {
  target: EventTarget;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    return this.target.addEventListener(type, listener, options);
  }

  container: HTMLElement | undefined;
  webLinksAddon: WebLinksAddon;
  fitAddon: FitAddon;

  tty: TTY;
  // shell: Shell;

  isOpen: boolean;
  pendingPrintOnOpen: string;

  disposables: IDisposable[] = [];

  constructor() {
    super();

    this.target = new EventTarget();

    // this.pasteEvent = this.xterm.on("paste", this.onPaste);
    this.disposables.push(this.onResize(this.handleTermResize));

    this.onKey((keyEvent: { key: string; domEvent: KeyboardEvent }) => {
      // Fix for iOS Keyboard Jumping on space
      if (keyEvent.key === ' ') {
        keyEvent.domEvent.preventDefault();
        // keyEvent.domEvent.stopPropagation();
        return false;
      }
    });

    // Set up our container
    this.container = undefined;

    // Load our addons
    this.webLinksAddon = new WebLinksAddon();
    this.fitAddon = new FitAddon();
    this.loadAddon(this.fitAddon);
    this.loadAddon(this.webLinksAddon);

    // this.config = config;

    // Create our Shell and tty
    this.disposables.push(
      this.onData((data) => {
        this.dispatchEvent(new CustomEvent('data', { detail: data }));
      }),
    );

    this.isOpen = false;
    this.pendingPrintOnOpen = '';
  }

  dispatchEvent(event: Event): boolean {
    return this.target.dispatchEvent(event);
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void {
    return this.target.removeEventListener(type, callback, options);
  }

  open(container: HTMLElement) {
    // Remove any current event listeners
    const focusHandler = this.focus.bind(this);
    if (this.container !== undefined) {
      MOBILE_KEYBOARD_EVENTS.forEach((eventName) => {
        this.container.removeEventListener(eventName, focusHandler);
      });
    }

    this.container = container;

    super.open(container);
    // this.xterm.loadAddon(new WebglAddon());
    this.isOpen = true;
    setTimeout(() => {
      // Fix for Mobile Browsers and their virtual keyboards
      if (this.container !== undefined) {
        MOBILE_KEYBOARD_EVENTS.forEach((eventName) => {
          this.container.addEventListener(eventName, focusHandler);
        });
      }

      if (this.pendingPrintOnOpen) {
        this.tty.print(this.pendingPrintOnOpen + '\n');
        this.pendingPrintOnOpen = '';
      }
    });
  }

  fit() {
    this.fitAddon.fit();
  }

  focus() {
    // this.xterm.blur();
    super.focus();
    // this.xterm.scrollToBottom();

    // To fix iOS keyboard, scroll to the cursor in the terminal
    this.scrollToCursor();
  }

  scrollToCursor() {
    if (!this.container) {
      return;
    }

    // We don't need cursorX, since we want to start at the beginning of the terminal.
    const cursorY = this.tty.getBufferSync().cursorY;
    const size = this.tty.getSize();

    const containerBoundingClientRect = this.container.getBoundingClientRect();

    // Find how much to scroll because of our cursor
    const cursorOffsetY = (cursorY / size.rows) * containerBoundingClientRect.height;

    let scrollX = containerBoundingClientRect.left;
    let scrollY = containerBoundingClientRect.top + cursorOffsetY + 10;

    if (scrollX < 0) {
      scrollX = 0;
    }
    if (scrollY > document.body.scrollHeight) {
      scrollY = document.body.scrollHeight;
    }

    window.scrollTo(scrollX, scrollY);
  }

  // print(message: string) {
  //   // For some reason, double new lines are not respected. Thus, fixing that here
  //   message = message.replace(/\n\n/g, '\n \n');

  //   if (!this.isOpen) {
  //     if (this.pendingPrintOnOpen) {
  //       this.pendingPrintOnOpen += message;
  //     } else {
  //       this.pendingPrintOnOpen = message;
  //     }
  //     return;
  //   }

  //   if (this.shell.isPrompting) {
  //     // Cancel the current prompt and restart
  //     this.shell.printAndRestartPrompt(() => {
  //       this.tty.print(message + '\n');
  //       return undefined;
  //     });
  //     return;
  //   }

  //   this.tty.print(message);
  // }

  dispose() {
    super.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  onPaste(data: string) {
    this.tty.print(data);
  }

  /**
   * Handle terminal resize
   *
   * This function clears the prompt using the previous configuration,
   * updates the cached terminal size information and then re-renders the
   * input. This leads (most of the times) into a better formatted input.
   */
  handleTermResize = (data: { rows: number; cols: number }) => {
    const { rows, cols } = data;
    this.tty.clearInput();
    this.tty.setTermSize(cols, rows);
    this.tty.setInput(this.tty.getInput(), true);
  };
}

//
export class TTY extends VirtualFile implements File {
  _termSize: {
    cols: number;
    rows: number;
  };

  rawMode: boolean = false;

  _firstInit: boolean = true;
  _cursor: number;
  _input: string;
  _promptPrefix: string;
  _continuationPromptPrefix: string;

  // _active: boolean = true;
  // _activePrompt;
  // _autocompleteHandlers: any;
  // maxAutocompleteEntries: number;
  // commandRunner: any;

  // inputStartCursor: number;

  constructor(public device: TerminalDevice) {
    super();
    this._flag = constants.fs.O_RDWR;

    this._termSize = {
      cols: this.device.cols,
      rows: this.device.rows,
    };
    this._promptPrefix = '';
    this._continuationPromptPrefix = '';
    this._input = '';
    this._cursor = 0;

    device.tty = this;
  }

  /**
   * Handle input completion
   */
  handleLineComplete = () => {
    this.print('\r\n');
    let buf = Buffer.from(this.getInput(), 'utf-8');
    this.pipe.writeBuffer(buf, 0, buf.length, null).then(() => {
      console.log('wrritten line', this.getInput());
    });

    this.setInput('');
  };

  /**
   * Insert character at cursor location
   */
  handleCursorInsert = (data: string) => {
    const newInput =
      this.getInput().substr(0, this.getCursor()) + data + this.getInput().substr(this.getCursor());
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
    this.device.write(normInput, cb);
  }

  /**
   * Prints a list of items using a wide-format
   */
  printWide(items: Array<string>, padding = 2) {
    if (items.length === 0) return this.println('');

    // Compute item sizes and matrix row/cols
    const itemWidth = items.reduce((width, item) => Math.max(width, item.length), 0) + padding;
    const wideCols = Math.floor(this._termSize.cols / itemWidth);
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
    const newInput = this.applyPrompts(input.substr(0, offset));
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
    const allRows = countLines(currentPrompt, this._termSize.cols);

    // Get the line we are currently in
    const promptCursor = this.applyPromptOffset(this._input, this._cursor);
    const { col, row } = offsetToColRow(currentPrompt, promptCursor, this._termSize.cols);

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
  getTermSize(): { rows: number; cols: number } {
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
  getSize(): { cols: number; rows: number } {
    return this._termSize;
  }

  /**
   * Function to return the terminal buffer
   */
  async getBuffer(): Promise<IBuffer> {
    return (this.device as Xterm).buffer.normal;
  }

  /**
   * Function to return the terminal buffer
   */
  getBufferSync(): IBuffer {
    return (this.device as Xterm).buffer.normal;
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
    const newLines = countLines(newPrompt, this._termSize.cols);
    const { col, row } = offsetToColRow(newPrompt, newCursor, this._termSize.cols);
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
    const inputLines = countLines(inputWithPrompt, this._termSize.cols);

    // Estimate previous cursor position
    const prevPromptOffset = this.applyPromptOffset(this._input, this._cursor);
    const { col: prevCol, row: prevRow } = offsetToColRow(
      inputWithPrompt,
      prevPromptOffset,
      this._termSize.cols,
    );

    // Estimate next cursor position
    const newPromptOffset = this.applyPromptOffset(this._input, newCursor);
    const { col: newCol, row: newRow } = offsetToColRow(
      inputWithPrompt,
      newPromptOffset,
      this._termSize.cols,
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
    this._termSize = { cols, rows };
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

  async writeBuffer(buffer: Buffer, offset: number, length: number, position: number) {
    this.device.write(buffer);
    return length;
  }

  async readBuffer(buffer: Buffer, offset: number, length: number, position: number) {
    return await this.pipe.readBuffer(buffer, offset, length, position);
  }

  pipe = new InMemoryPipe();
}
