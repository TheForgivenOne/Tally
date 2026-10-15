import { neon } from '@neondatabase/serverless';
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { resolvePrice, type CatalogEntry } from '@tally/shared';
import { aiResults, currentPrices, priceObservations, products, stores, tagReadCaps } from './schema.js';
import type { PriceStore, StoredObservation } from './store.js';
import type { CachedTagRead, Caps, NewTagRead, PhotoCache } from './vision.js';
import { PHOTO_CACHE_DAYS } from './vision.js';

export type NeonDb = ReturnType<typeof drizzle>;

/** Open a Neon HTTP client (fetch-based — safe on Workers, no TCP). */
export function openDb(connectionString: string): NeonDb {
  const sql = neon(connectionString);
  return drizzle(sql);
}

/**
 * Postgres-backed PriceStore. price_observations stays append-only:
 * add() only INSERTs; list() reads back for shared resolvePrice ranking.
 * Lower sources never overwrite higher ones (enforced in shared logic).
 */
export class DrizzlePriceStore implements PriceStore {
  constructor(private readonly db: NeonDb) {}

  async add(record: Omit<StoredObservation, 'id'>): Promise<StoredObservation> {
    // Parent rows must exist for the FKs. Stores/products carry no
    // personal data — this only ensures the referenced keys exist.
    await this.db.insert(stores).values({ id: record.storeId, name: record.storeId }).onConflictDoNothing({ target: stores.id });
    await this.db
      .insert(products)
      .values({ barcode: record.barcode, name: record.name ?? record.barcode, brand: record.brand ?? null, size: record.size ?? null })
      .onConflictDoUpdate({
        target: products.barcode,
        set: { name: record.name ?? record.barcode },
      });
    const rows = await this.db
      .insert(priceObservations)
      .values({
        storeId: record.storeId,
        barcode: record.barcode,
        name: record.name ?? null,
        brand: record.brand ?? null,
        size: record.size ?? null,
        priceMinor: record.priceMinor,
        source: record.source,
        observedAt: new Date(record.observedAt),
        confidence: record.confidence,
        promo: record.promo ?? false,
      })
      .returning({
        id: priceObservations.id,
        storeId: priceObservations.storeId,
        barcode: priceObservations.barcode,
        name: priceObservations.name,
        brand: priceObservations.brand,
        size: priceObservations.size,
        priceMinor: priceObservations.priceMinor,
        source: priceObservations.source,
        observedAt: priceObservations.observedAt,
        confidence: priceObservations.confidence,
        promo: priceObservations.promo,
      });
    const row = rows[0];
    if (!row) throw new Error('price observation insert returned no rows');
    const stored = toStored(row);
    // Keep the derived current price fresh on every write: the winner over
    // all observations (shared ranking — lower sources never win) is the
    // row the catalog seed and fast reads consume.
    const winner = resolvePrice(await this.list(record.storeId, record.barcode));
    if (winner) {
      await this.db
        .insert(currentPrices)
        .values({
          storeId: record.storeId,
          barcode: record.barcode,
          priceMinor: winner.priceMinor,
          source: winner.source,
          observedAt: new Date(winner.observedAt),
          confidence: winner.confidence,
        })
        .onConflictDoUpdate({
          target: [currentPrices.storeId, currentPrices.barcode],
          set: {
            priceMinor: winner.priceMinor,
            source: winner.source,
            observedAt: new Date(winner.observedAt),
            confidence: winner.confidence,
            updatedAt: new Date(),
          },
        });
    }
    return stored;
  }

  async catalog(storeId: string): Promise<CatalogEntry[]> {
    const rows = await this.db
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
    return rows.map((r) => ({
      barcode: r.barcode,
      name: r.name,
      ...(r.brand !== null ? { brand: r.brand } : {}),
      ...(r.size !== null ? { size: r.size } : {}),
      priceMinor: r.priceMinor,
      source: r.source as CatalogEntry['source'],
      observedAt: r.observedAt.toISOString(),
      confidence: r.confidence,
    }));
  }
  async list(storeId: string, barcode: string): Promise<StoredObservation[]> {
    const rows = await this.db
      .select({
        id: priceObservations.id,
        storeId: priceObservations.storeId,
        barcode: priceObservations.barcode,
        name: priceObservations.name,
        brand: priceObservations.brand,
        size: priceObservations.size,
        priceMinor: priceObservations.priceMinor,
        source: priceObservations.source,
        observedAt: priceObservations.observedAt,
        confidence: priceObservations.confidence,
        promo: priceObservations.promo,
      })
      .from(priceObservations)
      .where(
        and(eq(priceObservations.storeId, storeId), eq(priceObservations.barcode, barcode)),
      )
      .orderBy(desc(priceObservations.observedAt));
    return rows.map(toStored);
  }
}

interface ObservationRow {
  id: string;
  storeId: string;
  barcode: string;
  name: string | null;
  brand: string | null;
  size: string | null;
  priceMinor: number;
  source: string;
  observedAt: Date;
  confidence: number;
  promo: boolean;
}

function toStored(row: ObservationRow): StoredObservation {
  return {
    id: row.id,
    storeId: row.storeId,
    barcode: row.barcode,
    ...(row.name !== null ? { name: row.name } : {}),
    ...(row.brand !== null ? { brand: row.brand } : {}),
    ...(row.size !== null ? { size: row.size } : {}),
    priceMinor: row.priceMinor,
    source: row.source as StoredObservation['source'],
    observedAt: row.observedAt.toISOString(),
    confidence: row.confidence,
    ...(row.promo ? { promo: true as const } : {}),
  };
}

/**
 * Postgres-backed daily caps. Atomic increment per (key, day); stale days
 * are swept on each take so the table stays tiny without a cron job.
 */
export class DrizzleCaps implements Caps {
  constructor(
    private readonly db: NeonDb,
    private readonly limitPerDay: number = 50,
  ) {}

  async take(key: string): Promise<boolean> {
    const day = dayOf(key);
    const rows = await this.db
      .insert(tagReadCaps)
      .values({ key, day, count: 1 })
      .onConflictDoUpdate({
        target: [tagReadCaps.key, tagReadCaps.day],
        set: { count: sql`${tagReadCaps.count} + 1`, updatedAt: new Date() },
      })
      .returning({ count: tagReadCaps.count });
    const count = rows[0]?.count ?? this.limitPerDay + 1;
    // Best-effort hygiene; failure here must never block a legit read.
    await this.db.delete(tagReadCaps).where(lt(tagReadCaps.day, daysAgo(2))).catch(() => undefined);
    return count <= this.limitPerDay;
  }
}

/** The caller composes keys as `<scheme>:<id>:<YYYY-MM-DD>` — the tail is the day. */
function dayOf(key: string): string {
  return key.split(':').slice(-1)[0] ?? 'unknown';
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Postgres-backed photo cache over ai_results. Only hashes touch the disk —
 * photos are never stored. Stale rows stay as audit trail; lookup ignores
 * anything older than PHOTO_CACHE_DAYS.
 */
export class DrizzlePhotoCache implements PhotoCache {
  constructor(private readonly db: NeonDb) {}

  async lookup(imageHash: string): Promise<CachedTagRead | null> {
    const cutoff = new Date(Date.now() - PHOTO_CACHE_DAYS * 86_400_000);
    const rows = await this.db
      .select({
        storeId: aiResults.storeId,
        barcode: aiResults.barcode,
        name: aiResults.name,
        priceMinor: aiResults.priceMinor,
        confidence: aiResults.confidence,
        model: aiResults.model,
        observedAt: aiResults.createdAt,
      })
      .from(aiResults)
      .where(and(eq(aiResults.imageHash, imageHash), gt(aiResults.createdAt, cutoff)))
      .orderBy(desc(aiResults.createdAt))
      .limit(1);
    const row = rows[0];
    if (!row || !row.storeId) return null;
    return {
      storeId: row.storeId,
      barcode: row.barcode,
      name: row.name,
      priceMinor: row.priceMinor,
      confidence: row.confidence,
      model: row.model,
      observedAt: row.observedAt.toISOString(),
    };
  }

  async save(read: NewTagRead): Promise<void> {
    try {
      await this.db.insert(aiResults).values({
        storeId: read.storeId,
        barcode: read.barcode,
        name: read.name,
        priceMinor: read.priceMinor,
        confidence: read.confidence,
        model: read.model,
        imageHash: read.imageHash,
      });
    } catch {
      // Audit must never break a read that already succeeded.
    }
  }
}
