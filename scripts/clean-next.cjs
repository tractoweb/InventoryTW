/*
  Cleans Next.js build cache to prevent corrupted/mismatched server chunks.
  Fixes errors like:
  - Cannot find module './2482.js' from .next/server/webpack-runtime.js
  - 404 for /_next/static/* during dev
*/

const fs = require("fs");
const path = require("path");

function rm(target) {
  try {
    if (!fs.existsSync(target)) return;
    fs.rmSync(target, { recursive: true, force: true });
  } catch (e) {
    // Best-effort; on Windows files can be temporarily locked.
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // ignore
    }
  }
}

function main() {
  const root = process.cwd();
  rm(path.join(root, ".next"));
  rm(path.join(root, ".turbo"));
  rm(path.join(root, "node_modules", ".cache"));
}

main();
