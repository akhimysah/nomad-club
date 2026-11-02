// Crochets de chargement Node pour exécuter le code TypeScript de l'appli hors de Next.js (tests) :
// alias « @/ » → src/, imports sans extension → .ts / index.ts, et modules Next remplacés par des
// bouchons (next/headers, next/cache, next/navigation, server-only). Node 22 retire les types (strip-types).
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const STUBS = {
  "next/headers": "next-headers.mjs",
  "next/cache": "next-cache.mjs",
  "next/navigation": "next-navigation.mjs",
  "server-only": "empty.mjs",
};

function withExtension(path) {
  if (existsSync(path) && statSync(path).isFile()) return path;
  for (const ext of [".ts", ".mts", ".js", ".mjs"]) if (existsSync(path + ext)) return path + ext;
  for (const idx of ["index.ts", "index.js"]) if (existsSync(join(path, idx))) return join(path, idx);
  return null;
}

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: pathToFileURL(join(here, "stubs", STUBS[specifier])).href, shortCircuit: true };
  let target = null;
  if (specifier.startsWith("@/")) target = join(root, "src", specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) target = join(dirname(fileURLToPath(context.parentURL)), specifier);
  if (target) {
    const found = withExtension(target);
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  return next(specifier, context);
}
