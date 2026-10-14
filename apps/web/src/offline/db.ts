import Dexie, { type Table } from 'dexie';
import type { StoreCatalog } from '@tally/shared';
import type { CatalogStore, NewReport, OutboxStore, QueuedReport } from './sync.js';

interface OutboxRow extends NewReport {
  id?: number;
}

interface CatalogRow {
  storeId: string;
  catalog: StoreCatalog;
  cachedAt: string;
}

class TallyDb extends Dexie {
  catalog!: Table<CatalogRow, string>;
  outbox!: Table<OutboxRow, number>;

  constructor() {
    super('tally');
    this.version(1).stores({
      catalog: 'storeId',
      outbox: '++id',
    });
  }
}

export const db = new TallyDb();

/** Production Dexie-backed outbox. */
export const dexieOutbox: OutboxStore = {
  add: (report) => db.outbox.add(report),
  list: async () => (await db.outbox.orderBy('id').toArray()) as QueuedReport[],
  remove: (id) => db.outbox.delete(id).then(() => undefined),
  count: () => db.outbox.count(),
};

/** Production Dexie-backed catalog cache. */
export const dexieCatalog: CatalogStore = {
  put: async (storeId, catalog) =>
    void (await db.catalog.put({ storeId, catalog, cachedAt: new Date().toISOString() })),
  get: async (storeId) => (await db.catalog.get(storeId))?.catalog ?? null,
};
