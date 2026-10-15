import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { DrizzlePhotoCache, openDb } from './db.js';

const DATABASE_URL = process.env.DATABASE_URL;
const NS = `test-photo-${Date.now()}`;

/**
 * Neon integration: hash-keyed replays round-trip with audit fields, and
 * unknown hashes miss. Skipped without DATABASE_URL.
 */
(DATABASE_URL ? describe : describe.skip)('DrizzlePhotoCache (Neon)', () => {
  it('saves and replays a read by image hash', async () => {
    const db = openDb(DATABASE_URL!);
    const cache = new DrizzlePhotoCache(db);
    const imageHash = `${NS}-hash`;
    const storeId = `${NS}-store`;
    try {
      expect(await cache.lookup(imageHash)).toBeNull();
      await db.execute(sql`insert into stores(id, name) values (${storeId}, ${storeId})`);
      await cache.save({
        storeId,
        barcode: '012345678905',
        name: 'Photo Cache Coffee',
        priceMinor: 85000,
        confidence: 0.9,
        model: 'test-model',
        observedAt: '2026-10-15T12:00:00.000Z',
        imageHash,
      });
      const hit = await cache.lookup(imageHash);
      expect(hit?.priceMinor).toBe(85000);
      expect(hit?.name).toBe('Photo Cache Coffee');
      expect(hit?.model).toBe('test-model');
    } finally {
      await db.execute(sql`delete from ai_results where image_hash = ${imageHash}`);
      await db.execute(sql`delete from stores where id = ${storeId}`);
    }
  });
});
