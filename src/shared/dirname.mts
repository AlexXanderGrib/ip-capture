import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Chain } from "./chain.js";

export function getDirname(path = import.meta.url) {
  return new Chain(path).map(fileURLToPath).map(dirname);
}
