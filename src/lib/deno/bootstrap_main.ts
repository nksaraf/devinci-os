import '../denix/main.ts';
import { DenoIsolate } from './isolate';
import { Global } from '$lib/global';

declare global {
  interface Navigator {
    deno: DenoIsolate;
  }
}

export let isolate = new DenoIsolate({});

await isolate.attach(navigator.process);

Reflect.defineProperty(isolate.window.navigator, 'process', {
  value: navigator.process,
});

Reflect.defineProperty(isolate.window.navigator, 'isolate', {
  value: isolate,
});

Reflect.defineProperty(navigator, 'isolate', {
  value: isolate,
});

// We make Deno available to the worker global scope, but internally
// itll use the deno scope. could cause issues
Global.Deno = isolate.window.Deno;

// We wanna do this so that that the global fetch calls that are made
// use the Deno implementations
// could switch also, that fetch uses the Deno implementation
Global.Request = isolate.window.Request;
Global.Response = isolate.window.Response;
