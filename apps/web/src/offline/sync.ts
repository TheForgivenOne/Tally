import { validateCatalog, type PriceSource, type StoreCatalog } from '@tally/shared';

export type ReportSource = 'cache' | 'tag' | 'barcode-cache' | 'web' | 'ai';

export interface NewReport {
  storeId: string;
  barcode: string;
  name?: string;
  priceMinor: number;
  source: ReportSource;
  observedAt: string;
  confidence: number;
  promo?: boolean;
}

export type QueuedReport = NewReport & { id: number };

/** Minimal persistence boundary. Dexie implements it in prod; tests use memory. */
export interface OutboxStore {
  add(report: NewReport): Promise<number>;
  /** FIFO order. */
  list(): Promise<QueuedReport[]>;
  remove(id: number): Promise<void>;
  count(): Promise<number>;
}

export interface CatalogStore {
  put(storeId: string, catalog: StoreCatalog): Promise<void>;
  get(storeId: string): Promise<StoreCatalog | null>;
}

/** Queue a price report made offline. Flushed FIFO when connectivity returns. */
export async function enqueueReport(store: OutboxStore, report: NewReport): Promise<number> {
  return store.add(report);
}

export interface FlushResult {
  sent: number;
  kept: number;
}

/**
 * POST queued reports in FIFO order. 201s are dropped; anything else stays
 * queued. Stops at the first transport error (still offline).
 */
export async function flushOutbox(store: OutboxStore, apiBase: string): Promise<FlushResult> {
  const queued = await store.list();
  let sent = 0;
  for (const report of queued) {
    const { id, ...body } = report;
    let status: number;
    try {
      const res = await fetch(`${apiBase}/prices/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      status = res.status;
    } catch {
      break;
    }
    if (status === 201) {
      await store.remove(id);
      sent += 1;
    }
  }
  return { sent, kept: await store.count() };
}

/** Persist a validated catalog snapshot. Throws on contract violations. */
export async function saveCatalog(store: CatalogStore, catalog: unknown): Promise<void> {
  const result = validateCatalog(catalog);
  if (!result.ok) throw new Error(`Invalid catalog: ${result.error}`);
  await store.put(result.catalog.storeId, result.catalog);
}

/** Latest cached catalog for a store, or null when never cached. */
export async function getCatalog(store: CatalogStore, storeId: string): Promise<StoreCatalog | null> {
  return store.get(storeId);
}

export interface CachedPrice {
  barcode: string;
  name: string;
  priceMinor: number;
  source: PriceSource;
  observedAt: string;
  confidence: number;
}

/** Cache-first lookup: the device/server cache step of the resolution order. */
export function resolveFromCatalog(catalog: StoreCatalog | null, barcode: string): CachedPrice | null {
  const entry = catalog?.entries.find((e) => e.barcode === barcode) ?? null;
  if (!entry) return null;
  return {
    barcode: entry.barcode,
    name: entry.name,
    priceMinor: entry.priceMinor,
    source: entry.source,
    observedAt: entry.observedAt,
    confidence: entry.confidence,
  };
}

/**
 * Fetch the store catalog and cache it on-device. Resolves false when
 * offline or the server has nothing usable — callers treat the cache
 * as best-effort, never as a gate.
 */
export async function refreshCatalog(
  apiBase: string,
  store: CatalogStore,
  storeId: string,
): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}/catalog/${encodeURIComponent(storeId)}`);
  } catch {
    return false;
  }
  if (!res.ok) return false;
  try {
    await saveCatalog(store, await res.json());
    return true;
  } catch {
    return false;
  }
}

/** True when the browser reports connectivity. Server components default true. */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

/** Subscribe to connectivity flips. Returns an unsubscribe function. */
export function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}
