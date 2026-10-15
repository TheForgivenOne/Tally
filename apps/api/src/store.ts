import type { PriceObservation } from '@tally/shared';

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
}
