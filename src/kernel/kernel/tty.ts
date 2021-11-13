import mitt from 'mitt';
import type { IBuffer } from 'xterm';
import { Terminal } from 'xterm';
import type { File } from '../fs/core/file';
import type { CallbackThreeArgs, CallbackTwoArgs, IFileSystem } from '../fs/core/file_system';
import { AsyncKeyValueFileSystem } from '../fs/generic/key_value_filesystem';
import VirtualFile from '../fs/generic/virtual_file';
import type ShellHistory from '../shell/shell-history';
import { closestLeftBoundary, closestRightBoundary, isIncompleteInput } from '../shell/shell-utils';
import type { IDisposable } from '../terminal';
import { InMemoryPipe, PipeFile } from './pipe';

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

class TTYFileSystem extends AsyncKeyValueFileSystem implements IFileSystem {
  createFile() {}
}

let constants = {
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

interface IEventEmitter {
  on(event: string, callback: (...args: any[]) => void): IDisposable;

  emit(event: string, ...args: any[]): void;
}

export interface TerminalDevice {
  on(event: string, callback: (...args: any[]) => void): IDisposable;
  emit(event: string, args: any): void;
  write(data: any): void;
  get cols(): number;
  get rows(): number;
}

export class MittEventEmitter implements IEventEmitter {
  _events = mitt();

  on(event: string, callback: (...args: any[]) => void) {
    this._events.on(event, callback);

    return {
      dispose: () => {
        this._events.off(event, callback);
      },
    };
  }

  emit(event: string, args: any) {
    this._events.emit(event, args);
  }
}

export class TTYDevice extends MittEventEmitter implements TerminalDevice {
  get cols(): number {
    return 100;
  }
  get rows(): number {
    return 100;
  }
  write(data: string) {
    this.emit('output', data);
  }
}

export class Xterm extends Terminal implements IEventEmitter {
  on(event: string, callback: (...args: any[]) => void) {
    return this.onData(callback);
  }

  emit(event: string, args: any) {
    this.write(args);
  }
}

export class TTY extends VirtualFile implements File {
  _termSize: {
    cols: number;
    rows: number;
  };

  rawMode: boolean;

  _firstInit: boolean = true;
  _cursor: number;
  _input: string;
  _history: ShellHistory;
  // _active: boolean = true;
  // _activePrompt;
  // _autocompleteHandlers: any;
  // maxAutocompleteEntries: number;
  // commandRunner: any;

  // inputStartCursor: number;

  constructor(public device: TerminalDevice) {
    super();
    this._flag = 'w+';

    this._termSize = {
      cols: this.device.cols,
      rows: this.device.rows,
    };

    this._input = '';
    this._cursor = 0;
  }

  startReading() {
    this.device.on('data', this.handleStdin.bind(this));
  }

  handleStdin(data: string) {
    if (this.rawMode) {
      this.writeString(data);
    } else {
      this.runLineDiscipline(data);
    }
  }

  parseData(data: string) {
    const ord = data.charCodeAt(0);
    let ofs;

    if (ord === 0x1b) {
      switch (data.substr(1)) {
        case '[A': // Up arrow
          return constants.UP_ARROW;

        case '[B': // Down arrow
          return constants.DOWN_ARROW;

        case '[D': // Left Arrow
          return constants.LEFT_ARROW;

        case '[C': // Right Arrow
          return constants.RIGHT_ARROW;

        case '[3~': // Delete
          return constants.DELETE;

        case '[F': // End
          return constants.END;

        case '[H': // Home
          return constants.HOME;

        // case "b": // ALT + a

        case 'b': // ALT + LEFT
          return constants.ALT_LEFT_ARROW;

        case 'f': // ALT + RIGHT
          return constants.ALT_RIGHT_ARROW;

        case '\x7F': // CTRL + BACKSPACE
          return constants.CTRL_BACKSPACE;
      }

      // Handle special characters
    } else if (ord < 32 || ord === 0x7f) {
      switch (data) {
      }
    }
  }

  /**
   * Handle a single piece of information from the terminal -> tty.
   */
  runLineDiscipline = (data: string) => {
    // Only Allow CTRL+C Through
    // if (!this._active && data !== '\x03') {
    //   return;
    // }

    const ord = data.charCodeAt(0);
    let ofs;

    // Handle ANSI escape sequences
    if (ord === 0x1b) {
      switch (data.substr(1)) {
        case '[A': // Up arrow
          if (this._history) {
            let value = this._history.getPrevious();
            if (value) {
              this.setInput(value);
              this.setCursor(value.length);
            }
          }
          break;

        case '[B': // Down arrow
          if (this._history) {
            let value = this._history.getNext();
            if (!value) value = '';
            this.setInput(value);
            this.setCursor(value.length);
          }
          break;

        case '[D': // Left Arrow
          this.handleCursorMove(-1);
          break;

        case '[C': // Right Arrow
          this.handleCursorMove(1);
          break;

        case '[3~': // Delete
          this.handleCursorErase(false);
          break;

        case '[F': // End
          this.setCursor(this.getInput().length);
          break;

        case '[H': // Home
          this.setCursor(0);
          break;

        // case "b": // ALT + a

        case 'b': // ALT + LEFT
          ofs = closestLeftBoundary(this.getInput(), this.getCursor());
          if (ofs) this.setCursor(ofs);
          break;

        case 'f': // ALT + RIGHT
          ofs = closestRightBoundary(this.getInput(), this.getCursor());
          if (ofs) this.setCursor(ofs);
          break;

        case '\x7F': // CTRL + BACKSPACE
          ofs = closestLeftBoundary(this.getInput(), this.getCursor());
          if (ofs) {
            this.setInput(
              this.getInput().substr(0, ofs) + this.getInput().substr(this.getCursor()),
            );
            this.setCursor(ofs);
          }
          break;
      }

      // Handle special characters
    } else if (ord < 32 || ord === 0x7f) {
      switch (data) {
        case '\r': // ENTER
        case '\x0a': // CTRL+J
        case '\x0d': // CTRL+M
          if (isIncompleteInput(this.getInput())) {
            this.handleCursorInsert('\n');
          } else {
            this.handleLineComplete();
          }
          break;

        case '\x7F': // BACKSPACE
        case '\x08': // CTRL+H
        case '\x04': // CTRL+D
          this.handleCursorErase(true);
          break;

        // case '\t': // TAB
        //   if (this._autocompleteHandlers.length > 0) {
        //     const inputFragment = this.getInput().substr(0, this.getCursor());
        //     const hasTrailingSpace = hasTrailingWhitespace(inputFragment);
        //     const candidates = collectAutocompleteCandidates(
        //       this._autocompleteHandlers,
        //       inputFragment,
        //     );

        //     // Sort candidates
        //     candidates.sort();

        //     // Depending on the number of candidates, we are handing them in
        //     // a different way.
        //     if (candidates.length === 0) {
        //       // No candidates? Just add a space if there is none already
        //       if (!hasTrailingSpace) {
        //         this.handleCursorInsert(' ');
        //       }
        //     } else if (candidates.length === 1) {
        //       // Just a single candidate? Complete
        //       const lastToken = getLastToken(inputFragment);
        //       this.handleCursorInsert(candidates[0].substr(lastToken.length) + ' ');
        //     } else if (candidates.length <= this.maxAutocompleteEntries) {
        //       // If we are less than maximum auto-complete candidates, print
        //       // them to the user and re-start prompt
        //       this.printAndRestartPrompt(() => {
        //         this.printWide(candidates);
        //         return undefined;
        //       });
        //     } else {
        //       // If we have more than maximum auto-complete candidates, print
        //       // them only if the user acknowledges a warning
        //       // this.printAndRestartPrompt(() =>
        //       //   this.readChar(
        //       //     `Display all ${candidates.length} possibilities? (y or n)`,
        //       //   ).promise.then((yn: string) => {
        //       //     if (yn === 'y' || yn === 'Y') {
        //       //       this.printWide(candidates);
        //       //     }
        //       //   }),
        //       // );
        //     }
        //   } else {
        //     this.handleCursorInsert('    ');
        //   }
        //   break;

        case '\x01': // CTRL+A
          this.setCursor(0);
          break;

        case '\x02': // CTRL+B
          this.handleCursorMove(-1);
          break;

        case '\x03': // CTRL+C
        case '\x1a': // CTRL+Z
          const currentInput = this.getInput();
          this.setCursor(currentInput.length);
          this.setInput('');
          this.setCursorDirectly(0);
          this.print(currentInput + '^C\r\n');
          if (this._history) this._history.rewind();

          // Kill the command
          // if (this.commandRunner) {
          //   this.commandRunner.kill();
          //   this.commandRunner = undefined;
          // }

          // If we are prompting, then we want to cancel the current read
          // this.resolveActiveRead();

          break;

        case '\x05': // CTRL+E
          this.setCursor(this.getInput().length);
          break;

        case '\x06': // CTRL+F
          this.handleCursorMove(1);
          break;

        case '\x07': // CTRL+G
          if (this._history) this._history.rewind();
          this.setInput('');
          break;

        case '\x0b': // CTRL+K
          this.setInput(this.getInput().substring(0, this.getCursor()));
          this.setCursor(this.getInput().length);
          break;

        case '\x0c': // CTRL+L
          this.clear();
          this.print(`$ ${this.getInput()}`);
          break;

        case '\x0e': // CTRL+N
          if (this._history) {
            let value = this._history.getNext();
            if (!value) value = '';
            this.setInput(value);
            this.setCursor(value.length);
          }
          break;

        case '\x10': // CTRL+P
          if (this._history) {
            let value = this._history.getPrevious();
            if (value) {
              this.setInput(value);
              this.setCursor(value.length);
            }
          }
          break;

        case '\x15': // CTRL+U
          this.setInput(this.getInput().substring(this.getCursor()));
          this.setCursor(0);
          break;
      }

      // Handle visible characters
    } else {
      this.handleCursorInsert(data);
    }
  };

  /**
   * Handle input completion
   */
  handleLineComplete = () => {
    this.print('\r\n');
    let buf = Buffer.from(this.getInput(), 'utf-8');
    this.pipe.writeBuffer(buf, 0, buf.length, null, () => {
      console.log('written line', buf, buf.toString());
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
  print(message: string, sync?: boolean) {
    const normInput = message.replace(/[\r\n]+/g, '\n').replace(/\n/g, '\r\n');
    if (sync) {
      // We write it synchronously via hacking a bit on xterm
      // this.xtermwriteSync(normInput);
      // this.xterm._core._renderService._renderer._runOperation((renderer) =>
      //   renderer.onGridChanged(0, this.xterm.rows - 1),
      // );
      console.error('sync write not implemented');
    } else {
      this.device.write(normInput);
    }
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
   * Prints a status message on the current line. Meant to be used with clearStatus()
   */
  printStatus(message: string, sync?: boolean) {
    // Save the cursor position
    this.print('\u001b[s', sync);
    this.print(message, sync);
  }

  /**
   * Erase a character at cursor location
   */
  handleCursorErase = (backspace: boolean) => {
    if (backspace) {
      if (this.getCursor() <= 0) return;
      const newInput =
        this.getInput().substr(0, this.getCursor() - 1) + this.getInput().substr(this.getCursor());
      this.clearInput();
      this.setCursorDirectly(this.getCursor() - 1);
      this.setInput(newInput, true);
    } else {
      const newInput =
        this.getInput().substr(0, this.getCursor()) + this.getInput().substr(this.getCursor() + 1);
      this.setInput(newInput);
    }
  };

  /**
   * Move cursor at given direction
   */
  handleCursorMove = (dir: number) => {
    if (dir > 0) {
      const num = Math.min(dir, this.getInput().length - this.getCursor());
      this.setCursorDirectly(this.getCursor() + num);
    } else if (dir < 0) {
      const num = Math.max(dir, -this.getCursor());
      this.setCursorDirectly(this.getCursor() + num);
    }
  };

  /**
   * Clears the current status on the line, meant to be run after printStatus
   */
  clearStatus(sync?: boolean) {
    // Restore the cursor position
    this.print('\u001b[u', sync);
    // Clear from cursor to end of screen
    this.print('\u001b[1000D', sync);
    this.print('\u001b[0J', sync);
  }

  /**
   * Apply prompts to the given input
   */
  applyPrompts(input: string): string {
    return input;
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

    for (let i = 0; i < currentPrompt.length; ++i) {
      this.device.write('\b');
    }

    // Get the overall number of lines to clear
    // const allRows = countLines(currentPrompt, this._termSize.cols);

    // // Get the line we are currently in
    // const promptCursor = this.applyPromptOffset(this._input, this._cursor);
    // const { col, row } = offsetToColRow(currentPrompt, promptCursor, this._termSize.cols);

    // // First move on the last line
    // const moveRows = allRows - row - 1;
    // for (let i = 0; i < moveRows; ++i) this.master.write('\x1B[E');

    // // Clear current input line(s)
    // this.master.write('\r\x1B[K');
    // for (let i = 1; i < allRows; ++i) this.master.write('\x1B[F\x1B[K');
  }

  /**
   * Clears the entire Tty
   *
   * This function will erase all the lines that display on the tty,
   * and move the cursor in the beginning of the first line of the prompt.
   */
  clear() {
    this.truncateSync();
  }

  truncateSync() {
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
  getBuffer(): IBuffer {
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

    // this.master.write('\r');
    // for (let i = 0; i < moveUpRows; ++i) this.master.write('\x1B[F');
    // for (let i = 0; i < col; ++i) this.master.write('\x1B[C');

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

    console.log(prevCol, newCol);

    // Adjust vertically
    if (newRow > prevRow) {
      for (let i = prevRow; i < newRow; ++i) this.device.write('\x1B[B');
    } else {
      for (let i = newRow; i < prevRow; ++i) this.device.write('\x1B[A');
    }

    // Adjust horizontally
    if (newCol > prevCol) {
      for (let i = prevCol; i < newCol; ++i) this.device.write('\x1B[C');
    } else {
      for (let i = newCol; i < prevCol; ++i) this.device.write('\x1B[D');
    }

    // Set new offset
    this._cursor = newCursor;
  }

  setTermSize(cols: number, rows: number) {
    this._termSize = { cols, rows };
  }

  writeBuffer(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: CallbackThreeArgs<number, Buffer>,
  ) {
    this.device.write(buffer);
  }

  readBuffer(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: CallbackTwoArgs<number>,
  ) {
    this.pipe.readBuffer(buffer, offset, length, position, callback);
  }

  pipe = new InMemoryPipe();
}

/**
 * A tty is a particular device file, that sits between the shell and the terminal.
 * It acts an an interface for the shell and terminal to read/write from,
 * and communicate with one another
 */
// export class PTYSlaveFile extends VirtualFile implements File {
//   constructor(private _tty: TTY) {
//     super();
//     this._flag = 'w+';
//   }

//   writeBuffer(
//     buffer: Buffer,
//     offset: number,
//     length: number,
//     position: number,
//     cb: CallbackThreeArgs<number, Buffer>,
//   ): void {
//     this._tty.write(buffer, offset, length, position, () => cb(null, length));
//   }

//   readBuffer(
//     buffer: Buffer,
//     offset: number,
//     length: number,
//     position: number,
//     cb: CallbackThreeArgs<number, Buffer>,
//   ) {
//     this._tty.read(buffer, offset, length, position, cb);
//   }
// }
