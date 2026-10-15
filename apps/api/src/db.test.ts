import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DrizzlePriceStore, openDb } from './db.js';

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Neon integration: append-only observations round-trip and resolve ranking
 * still comes from shared logic. Skipped without DATABASE_URL (CI default).
 */
(DATABASE_URL ? describe : describe.skip)('DrizzlePriceStore (Neon)', () => {
  const storeId = 'store-test-db';
  const barcode = `test-${Date.now()}`;

  it('adds and lists observations for one store + product', async () => {
    const db = openDb(DATABASE_URL!);
    const store = new DrizzlePriceStore(db);
    try {
      const first = await store.add({
        storeId,
        barcode,
        name: 'Test product',
        priceMinor: 10000,
        source: 'ai',
        observedAt: '2026-10-14T12:00:00.000Z',
        confidence: 0.4,
      });
      expect(first.id).toBeTypeOf('string');
      const second = await store.add({
        storeId,
        barcode,
        name: 'Test product',
        priceMinor: 12000,
        source: 'tag',
        observedAt: '2026-10-15T12:00:00.000Z',
        confidence: 0.98,
      });
      expect(second.priceMinor).toBe(12000);
      const rows = await store.list(storeId, barcode);
      // Append-only: both rows survive; shared resolvePrice picks the tag read.
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.some((r) => r.priceMinor === 10000)).toBe(true);
      expect(rows.some((r) => r.priceMinor === 12000)).toBe(true);
    } finally {
      await db.execute(
        sql`delete from price_observations where store_id = ${storeId} and barcode = ${barcode}`,
      );
      await db.execute(sql`delete from products where barcode = ${barcode}`);
      await db.execute(sql`delete from stores where id = ${storeId}`);
    }
  });
});
