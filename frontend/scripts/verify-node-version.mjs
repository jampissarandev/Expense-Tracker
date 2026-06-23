// Verify the active Node.js major version matches the project's .nvmrc.
// Fails the process (non-zero exit) if there's a mismatch.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const expected = readFileSync(resolve(here, '..', '.nvmrc'), 'utf8').trim();
const actual = process.version.match(/^v(\d+)/)[1];

if (actual !== expected) {
  console.error(
    `Node major version mismatch: expected ${expected}, got ${actual}`,
  );
  process.exit(1);
}

console.log(`Node major version OK: ${actual}`);
