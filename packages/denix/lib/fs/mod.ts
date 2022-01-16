import InMemoryFileSystem from './inmemory.ts';
import { VirtualFileSystem } from './virtual.ts';

export let fs = new VirtualFileSystem(new InMemoryFileSystem());
