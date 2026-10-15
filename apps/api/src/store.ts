import type { CatalogEntry, PriceObservation } from '@tally/shared';
import { resolvePrice } from '@tally/shared';

/** A stored price observation, keyed to a store + product. Anonymous by construction. */
export interface StoredObservation extends PriceObservation {
  id: string;
  storeId: string;
  barcode: string;
  name?: string;
  brand?: string;
  size?: string;
  promo?: boolean;
}

/** Ports-and-adapters boundary: routes depend on this, Neon implements it. Async: Postgres in prod, memory in tests. */
export interface PriceStore {
  add(record: Omit<StoredObservation, 'id'>): Promise<StoredObservation>;
  list(storeId: string, barcode: string): Promise<StoredObservation[]>;
  /** Derived per-store catalog: one winning entry per product. */
  catalog(storeId: string): Promise<CatalogEntry[]>;
}

export class MemoryPriceStore implements PriceStore {
  private records: StoredObservation[] = [];

  async add(record: Omit<StoredObservation, 'id'>): Promise<StoredObservation> {
    const stored: StoredObservation = { ...record, id: crypto.randomUUID() };
    this.records.push(stored);
    return stored;
  }

  async list(storeId: string, barcode: string): Promise<StoredObservation[]> {
    return this.records.filter((r) => r.storeId === storeId && r.barcode === barcode);
  }

  async catalog(storeId: string): Promise<CatalogEntry[]> {
    const byBarcode = new Map<string, StoredObservation[]>();
    for (const r of this.records) {
      if (r.storeId !== storeId) continue;
      const group = byBarcode.get(r.barcode) ?? [];
      group.push(r);
      byBarcode.set(r.barcode, group);
    }
    const entries: CatalogEntry[] = [];
    for (const [barcode, group] of byBarcode) {
      const winner = resolvePrice(group);
      if (!winner || winner.name === undefined) continue;
      entries.push({
        barcode,
        name: winner.name,
        ...(winner.brand !== undefined ? { brand: winner.brand } : {}),
        ...(winner.size !== undefined ? { size: winner.size } : {}),
        priceMinor: winner.priceMinor,
        source: winner.source,
        observedAt: winner.observedAt,
        confidence: winner.confidence,
        ...(winner.promo ? { promo: true as const } : {}),
      });
    }
    return entries;
  }
}
