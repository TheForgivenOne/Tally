/**
 * Build a per-store catalog JSON for R2.
 *
 * Source today: committed fixture (seed/barcodes-<store>.json). Once the
 * Drizzle slice lands, the source becomes `SELECT ... FROM current_prices`
 * and this file's readFixture() is replaced — the contract + validation stay.
 *
 * Usage:
 *   pnpm --filter @tally/api seed -- --store store-mobay-hilo --out catalog.json
 *
 * Upload (needs a Cloudflare login — run by a human, never headless):
 *   wrangler r2 object put tally-catalog/store-mobay-hilo.json --file=catalog.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { validateCatalog } from '@tally/shared';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

const storeId = arg('store');
const outPath = arg('out');

const raw = JSON.parse(await readFile(new URL(`../seed/barcodes-${storeId.split('/').pop()}.json`, import.meta.url), 'utf8')) as unknown[];

const checked = validateCatalog({
  version: 1,
  storeId,
  generatedAt: new Date().toISOString(),
  entries: raw,
});

if (!checked.ok) {
  console.error(`Invalid catalog: ${checked.error}`);
  process.exit(1);
}

await writeFile(outPath, JSON.stringify(checked.catalog, null, 2) + '\n');
console.log(`Wrote ${outPath}: ${checked.catalog.entries.length} entries for ${storeId}`);
