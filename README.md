> 🛑🛑 Note: This is the just an experiment on top of macOS Web written in Svelte by PuruVijay. That version is available at [PuruVJ/macos-web](https://github.com/puruvj/macos-web) 🛑

# Denix

A tiny kernel written in Typescript

- interpreted dynamic kernel
- use existing Web APIs
- esm module syntax
- top level await
- inspired by Stackblitz running Node.js on the browser
- process management across Web workers
  - spawn web workers for every process to isolate the system from any process going bonkers
  - code for any command/application is only loaded when the process in spawned, and its only loaded in the web worker
  - no process can mess with the global scope of the main thread, but they can modify their own global scope for things like Emscripten to work well inside this
  - communicate with the main thread via messaging using Comlink proxies
  - kill web worker on error or when the script is done
  - support long running processes like servers
  - has information about running processes, ala `ps`
  - stdin, stdout, stderr streams available to processes just like on the OS (another way for processes to interact)
- virtual filesystem
  - different storage backends (in-memory)
  - consistent API that can nested together to get a versatile filesystem
  - shared filesystem works sync/async on all workers
  - devices like tty, etc. are represented as files in the /dev mounted filesystem
  - /proc has information about the running processes
- javascript modules are executable files in the kernel
- ops are like linux syscalls, allowing the user space (code run in processes) to access the kernel, eg. filesystem, io, networking, etc.

- Runtimes that can work on top of this:

  - Deno (https://deno.land)
    - partial (not all ops implemented yet)
    - Deno runtime loaded from `denoland/deno` repo directly and run in the browser,
    - kernel ops API is identical to Deno's, so the Deno runtime is just connected to the denix kernel
    - get Deno's well maintained standard library, (https://deno.land/std)
  - Node
    - partial (based on Deno's compatibility layer)
    - runs using the Deno compatibility layer
  - Python
    - Runs using pyodide, which is a web-based python runtime compiled using Emscripten
  - WASM + WASI
    - Deno has a WASI implementation, which would eventually use our kernel via the Deno API
  - SQLite
    - Runs using absurd-sql, again based on Emscripten compiled sqlite
    - doesnt exist on denix filesystem yet

- ## Existing applications:
  - deno CLI
    - deno run <script-url>
    - runs script with import.meta.main = true (Deno convention)
    - will wait for script to actually exit, i.e, all long running tasks are done, like servers

# Devinci OS

This open source project aims to replicate some of the Mac OS(Monterey, at the time of writing)'s desktop experience on web, using WebAssembly.

## OS for the browser

- MacOS like interface
  - Forked from the awesome PuruVijay's macos-web
- Full screen experience for apps
- Cross-tab experience using service worker
- VSCode inbuilt (real version)
- Web assembly + WASI based OS
- Persisted File system

Apps - Calculator, Calendar, Editor, VS Code, Finder, Desktop

OS:
Menubar (auto-hide, show current app)
Windows (multiple windows, full screen)
Dock (auto-hide)

# Stack

- UI Framework - Svelte
- Bundler - Vite, for super fast development.
- Component Library - None!!
- Styling Solution - SCSS and UnoCSS.

# When will it be ready?

![Who knows?](https://i.imgur.com/6xfbPzs.gif)

# Can I contribute?

Sure, open an issue, point out errors, and what not. Wanna fix something yourselves, you're welcome to open a PR and I appreciate it.
