// FotoAI test runner.
//
// The tests are TypeScript run by Node's built-in type stripping, which needs
// Node >= 22.6. The application runtime (Dockerfile) is not required to meet
// this; lib/fotoai only uses APIs available in Node 18.17+ (fetch, FormData,
// Web Streams, node:crypto). This runner fails fast with a clear message
// instead of a confusing syntax error on an older Node.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_MAJOR = 22;
const MIN_MINOR = 6;

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < MIN_MAJOR || (major === MIN_MAJOR && minor < MIN_MINOR)) {
  console.error(
    `test:fotoai needs Node >= ${MIN_MAJOR}.${MIN_MINOR} (built-in TypeScript type stripping); ` +
    `found ${process.versions.node}. Run the tests with a newer local Node; the app runtime is unaffected.`,
  );
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const pattern = join(here, '**', '*.test.ts');
const args = ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--test', pattern];

console.log(`# node ${process.versions.node}`);
console.log(`# node ${args.join(' ')}`);
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
