// Ensures ../web/dist exists so `wrangler dev` accepts the assets binding on a
// clean clone. The real build overwrites this placeholder via `pnpm build`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', '..', 'web', 'dist');
const index = resolve(dist, 'index.html');

if (!existsSync(dist)) {
  mkdirSync(dist, { recursive: true });
  console.log(`[ensure-assets] created ${dist}`);
}

if (!existsSync(index)) {
  writeFileSync(
    index,
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Argus Audit API</title></head><body><p>The web app is not built. Run <code>pnpm dev:web</code> for the UI, or <code>pnpm build</code> for the production bundle.</p></body></html>\n',
  );
  console.log('[ensure-assets] wrote placeholder index.html');
}
