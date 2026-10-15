import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { DrizzleCaps, openDb } from './db.js';
import { tagReadCaps } from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL;
const NS = `test-caps-${Date.now()}`;

/**
 * Neon integration: counters survive (no process memory involved) and the
 * daily limit is enforced per key. Skipped without DATABASE_URL.
 */
(DATABASE_URL ? describe : describe.skip)('DrizzleCaps (Neon)', () => {
  it('enforces the daily limit per key and isolates keys', async () => {
    const db = openDb(DATABASE_URL!);
    const caps = new DrizzleCaps(db, 2);
    const day = new Date().toISOString().slice(0, 10);
    const key = `${NS}:device:abc:${day}`;
    try {
      expect(await caps.take(key)).toBe(true);
      expect(await caps.take(key)).toBe(true);
      expect(await caps.take(key)).toBe(false);
      // A different identity keeps its own budget.
      expect(await caps.take(`${NS}:device:xyz:${day}`)).toBe(true);
    } finally {
      await db.execute(sql`delete from tag_read_caps where key like ${NS + '%'}`);
    }
  });

  it('sweeps stale days on take', async () => {
    const db = openDb(DATABASE_URL!);
    const caps = new DrizzleCaps(db, 50);
    const day = new Date().toISOString().slice(0, 10);
    const staleKey = `${NS}:stale:2000-01-01`;
    try {
      await db.execute(sql`insert into tag_read_caps(key, day, count) values (${staleKey}, '2000-01-01', 50)`);
      expect(await caps.take(`${NS}:fresh:${day}`)).toBe(true);
      const left = await db.select().from(tagReadCaps).where(eq(tagReadCaps.key, staleKey));
      expect(left.length).toBe(0);
    } finally {
      await db.execute(sql`delete from tag_read_caps where key like ${NS + '%'}`);
    }
  });
});
