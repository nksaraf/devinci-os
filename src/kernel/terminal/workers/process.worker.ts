// Expoprt process as a worker
import * as Comlink from "comlink";
import Process from "../../process";

Comlink.expose(Process);
