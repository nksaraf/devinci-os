import InMemoryFileSystem from './inmemory';
import { VirtualFileSystem } from './virtual';

export let fs = new VirtualFileSystem(new InMemoryFileSystem());
