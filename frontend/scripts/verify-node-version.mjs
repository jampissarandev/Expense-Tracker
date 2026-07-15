// Verify the active Node.js major version matches the project's .nvmrc.
// Fails the process (non-zero exit) if there's a mismatch.
//
// `.nvmrc` may contain either a major version (e.g. "22") or an exact
// pinned version (e.g. "22.22.0"). We only enforce the major here, since
// that is what the project's `engines.node` constraint guarantees
// (">=22.0.0 <23"). Exact pin enforcement is delegated to npm ci via the
// package-lock and to CI's `node-version:` step in .github/workflows/ci.yml.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const expectedRaw = readFileSync(resolve(here, '..', '.nvmrc'), 'utf8').trim();
const expectedMajor = expectedRaw.match(/^v?(\d+)/)[1];
const actualMajor = process.version.match(/^v(\d+)/)[1];

if (actualMajor !== expectedMajor) {
  console.error(
    `Node major version mismatch: expected ${expectedMajor} (from .nvmrc "${expectedRaw}"), got ${actualMajor} (${process.version})`,
  );
  process.exit(1);
}

console.log(
  `Node major version OK: ${actualMajor} (expected ${expectedMajor} from .nvmrc "${expectedRaw}", running ${process.version})`,
);
