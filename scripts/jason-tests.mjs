// Run the vendored Jason (studio_*) upstream test suite.
//
// The suite is written for `bun test` and uses nothing but `bun:test` primitives, so it
// runs unmodified against the vendored tree — no Node shim and no patched expectations.
// It is run from inside `vendor/jason` so the upstream `@/*` -> `./*` path mapping in that
// directory's own tsconfig.json applies, exactly as it does upstream.
//
// Bun is a test-only tool here; it is not a dependency of the published package.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const suiteDir = resolve(root, 'vendor/jason');

// Prefer a real Bun binary over a launcher shim. A WinGet/symlink launcher can add ~10 s
// to every child process, and this suite spawns one of its own.
const candidates = [
  process.env.BUN_EXECUTABLE,
  resolve(root, 'node_modules/bun/bin/bun.exe'),
  resolve(root, 'node_modules/bun/bin/bun'),
  'bun',
].filter(Boolean);

const bun = candidates.find(candidate =>
  candidate === 'bun' || existsSync(candidate));

if (!bun) {
  console.error('Bun is required to run the vendored upstream tests.');
  console.error('Install it with `npm i --no-save bun`, or set BUN_EXECUTABLE.');
  process.exit(1);
}

// --timeout: the suite's default 5 s is too tight for machines where spawning a child and
// resolving the fixture's module graph is slow. Upstream's own CI is faster; the value is
// a runner setting, not a change to the vendored tests.
const args = ['test', '--timeout', '30000', ...process.argv.slice(2)];
console.log(`bun ${args.join(' ')}  (cwd: vendor/jason, executable: ${bun})`);

const result = spawnSync(bun, args, {cwd: suiteDir, stdio: 'inherit', env: process.env});
if (result.error) {
  console.error(`Failed to run Bun: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
