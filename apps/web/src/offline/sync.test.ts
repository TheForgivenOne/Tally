import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreCatalog } from '@tally/shared';
import {
  enqueueReport,
  flushOutbox,
  getCatalog,
  isOnline,
  saveCatalog,
  subscribeOnline,
  type CatalogStore,
  type NewReport,
  type OutboxStore,
  type QueuedReport,
} from './sync.js';

/** In-memory OutboxStore: exercises the real sync logic, not Dexie's driver. */
class MemoryOutbox implements OutboxStore {
  private rows: QueuedReport[] = [];
  private nextId = 1;

  async add(report: NewReport): Promise<number> {
    const id = this.nextId++;
    this.rows.push({ ...report, id });
    return id;
  }

  async list(): Promise<QueuedReport[]> {
    return [...this.rows].sort((a, b) => a.id - b.id);
  }

  async remove(id: number): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
  }

  async count(): Promise<number> {
    return this.rows.length;
  }
}

class MemoryCatalog implements CatalogStore {
  private rows = new Map<string, StoreCatalog>();

  async put(storeId: string, catalog: StoreCatalog): Promise<void> {
    this.rows.set(storeId, catalog);
  }

  async get(storeId: string): Promise<StoreCatalog | null> {
    return this.rows.get(storeId) ?? null;
  }
}

const CATALOG = {
  version: 1 as const,
  storeId: 'store-mobay-hilo',
  generatedAt: '2026-10-14T12:00:00.000Z',
  entries: [
    {
      barcode: '012345678905',
      name: 'Tastee Cheese 250g',
      priceMinor: 125000,
      source: 'tag' as const,
      observedAt: '2026-10-14T12:00:00.000Z',
      confidence: 0.95,
    },
  ],
};

const REPORT: NewReport = {
  storeId: 'store-mobay-hilo',
  barcode: '012345678905',
  priceMinor: 125000,
  source: 'tag',
  observedAt: '2026-10-14T12:00:00.000Z',
  confidence: 0.9,
};

let outbox: MemoryOutbox;
let catalog: MemoryCatalog;

beforeEach(() => {
  outbox = new MemoryOutbox();
  catalog = new MemoryCatalog();
  vi.unstubAllGlobals();
});

describe('outbox', () => {
  it('enqueues reports and counts them', async () => {
    expect(await outbox.count()).toBe(0);
    await enqueueReport(outbox, REPORT);
    await enqueueReport(outbox, { ...REPORT, priceMinor: 130000 });
    expect(await outbox.count()).toBe(2);
  });

  it('flushes FIFO, dropping 201s and keeping failures', async () => {
    await enqueueReport(outbox, REPORT);
    await enqueueReport(outbox, { ...REPORT, priceMinor: 130000 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 201 })
      .mockResolvedValueOnce({ status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const result = await flushOutbox(outbox, 'https://api.example.test');
    expect(result.sent).toBe(1);
    expect(result.kept).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    const sentBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { priceMinor: number };
    expect(sentBody.priceMinor).toBe(125000);
    expect(await outbox.count()).toBe(1);
  });

  it('stops at transport errors and keeps everything', async () => {
    await enqueueReport(outbox, REPORT);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new Error('offline')),
    );
    const result = await flushOutbox(outbox, 'https://api.example.test');
    expect(result).toEqual({ sent: 0, kept: 1 });
  });
});

describe('connectivity', () => {
  it('reports a boolean and notifies subscribers on flips', () => {
    expect(typeof isOnline()).toBe('boolean');
    let calls = 0;
    const stop = subscribeOnline(() => {
      calls += 1;
    });
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(calls).toBe(2);
    stop();
    window.dispatchEvent(new Event('offline'));
    expect(calls).toBe(2);
  });
});

describe('catalog cache', () => {
  it('saves and reads back a validated catalog', async () => {
    await saveCatalog(catalog, CATALOG);
    expect((await getCatalog(catalog, 'store-mobay-hilo'))?.entries).toHaveLength(1);
  });

  it('returns null for unknown stores and refuses invalid catalogs', async () => {
    expect(await getCatalog(catalog, 'store-nowhere')).toBeNull();
    await expect(saveCatalog(catalog, { ...CATALOG, version: 999 })).rejects.toThrow();
  });
});
