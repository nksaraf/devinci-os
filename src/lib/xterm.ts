import { Terminal } from 'xterm';
import { TTY, MOBILE_KEYBOARD_EVENTS } from './tty/tty';
import type { IDisposable, TerminalDevice } from './tty/tty';

// dispatches 'data' event when data is received from the terminal
// listen to this to handle data
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

  tty: TTY;
  // shell: Shell;
  isOpen: boolean;
  pendingPrintOnOpen: string;

  disposables: IDisposable[] = [];

  constructor() {
    super();

    this.target = new EventTarget();

    // Set up our container
    this.container = undefined;

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

  async open(container: HTMLElement) {
    await import('xterm/css/xterm.css');

    this.disposables.push(this.onResize(this.handleTermResize));

    this.onKey((keyEvent: { key: string; domEvent: KeyboardEvent }) => {
      // Fix for iOS Keyboard Jumping on space
      if (keyEvent.key === ' ') {
        keyEvent.domEvent.preventDefault();
        // keyEvent.domEvent.stopPropagation();
        return false;
      }
    });

    // Remove any current event listeners
    const focusHandler = this.focus.bind(this);
    if (this.container !== undefined) {
      MOBILE_KEYBOARD_EVENTS.forEach((eventName) => {
        this.container.removeEventListener(eventName, focusHandler);
      });
    }

    const { WebLinksAddon } = await import('xterm-addon-web-links');

    let webLinksAddon = new WebLinksAddon();
    this.loadAddon(webLinksAddon);

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

  async fit() {
    const { FitAddon } = await import('xterm-addon-fit');
    let fitAddon = new FitAddon();
    this.loadAddon(fitAddon);
    fitAddon.fit();
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
    const cursorY = this.buffer.normal.cursorY;
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

  write(data: Uint8Array, cb) {
    // console.log(new TextDecoder().decode(data));
    super.write(data, cb);
  }
}
