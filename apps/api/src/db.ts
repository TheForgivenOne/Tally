import { neon } from '@neondatabase/serverless';
import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { priceObservations, products, stores } from './schema.js';
import type { PriceStore, StoredObservation } from './store.js';

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
    return toStored(row);
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
