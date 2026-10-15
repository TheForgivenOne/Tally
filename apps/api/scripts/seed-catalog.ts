/**
 * Build a per-store catalog JSON for R2.
 *
 * Two sources:
 * - `--from-db` (preferred): SELECT from live `current_prices` + `products`.
 *   Needs DATABASE_URL in the environment (Neon creds — never committed).
 * - default: committed fixture (seed/barcodes-<store>.json), for offline work.
 *
 * The contract + validation stay identical either way.
 *
 * Usage:
 *   pnpm --filter @tally/api seed -- --store store-demo-1 --out catalog.json [--from-db]
 *
 * Upload (needs a Cloudflare login — run by a human, never headless):
 *   wrangler r2 object put tally-catalog/store-demo-1.json --file=catalog.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { validateCatalog } from '@tally/shared';
import { openDb } from '../src/db.js';
import { currentPrices, products } from '../src/schema.js';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

const storeId = arg('store');
const outPath = arg('out');
const fromDb = process.argv.includes('--from-db');

let raw: unknown[];
if (fromDb) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing DATABASE_URL in the environment');
  const db = openDb(url);
  const rows = await db
    .select({
      barcode: currentPrices.barcode,
      name: products.name,
      brand: products.brand,
      size: products.size,
      priceMinor: currentPrices.priceMinor,
      source: currentPrices.source,
      observedAt: currentPrices.observedAt,
      confidence: currentPrices.confidence,
    })
    .from(currentPrices)
    .innerJoin(products, eq(products.barcode, currentPrices.barcode))
    .where(eq(currentPrices.storeId, storeId));
  raw = rows.map((r) => ({
    barcode: r.barcode,
    name: r.name,
    ...(r.brand !== null ? { brand: r.brand } : {}),
    ...(r.size !== null ? { size: r.size } : {}),
    priceMinor: r.priceMinor,
    source: r.source,
    observedAt: r.observedAt.toISOString(),
    confidence: r.confidence,
  }));
} else {
  raw = JSON.parse(await readFile(new URL(`../seed/barcodes-${storeId.split('/').pop()}.json`, import.meta.url), 'utf8')) as unknown[];
}

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
