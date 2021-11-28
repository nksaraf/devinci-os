import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { TerminalDevice, TTY, IDisposable, MOBILE_KEYBOARD_EVENTS } from './tty';

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
    options?: boolean | AddEventListenerOptions
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

    this.onKey((keyEvent: { key: string; domEvent: KeyboardEvent; }) => {
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
      })
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
    options?: boolean | EventListenerOptions
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
  handleTermResize = (data: { rows: number; cols: number; }) => {
    const { rows, cols } = data;
    this.tty.clearInput();
    this.tty.setTermSize(cols, rows);
    this.tty.setInput(this.tty.getInput(), true);
  };
}
