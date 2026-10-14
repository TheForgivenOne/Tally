import { describe, expect, it } from 'vitest';
import { CATALOG_VERSION, validateCatalog } from './catalog.js';

const ENTRY = {
  barcode: '012345678905',
  name: 'Tastee Cheese 250g',
  priceMinor: 125000,
  source: 'tag',
  observedAt: '2026-10-14T12:00:00.000Z',
  confidence: 0.95,
};

const CATALOG = {
  version: 1,
  storeId: 'store-mobay-hilo',
  generatedAt: '2026-10-14T12:00:00.000Z',
  entries: [ENTRY],
};

describe('validateCatalog', () => {
  it('accepts a well-formed catalog', () => {
    const result = validateCatalog(CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.catalog.entries).toHaveLength(1);
  });

  it('rejects wrong versions, bad prices, and bad sources', () => {
    expect(validateCatalog({ ...CATALOG, version: 999 }).ok).toBe(false);
    expect(validateCatalog({ ...CATALOG, entries: [{ ...ENTRY, priceMinor: -1 }] }).ok).toBe(false);
    expect(validateCatalog({ ...CATALOG, entries: [{ ...ENTRY, source: 'guess' }] }).ok).toBe(false);
    expect(validateCatalog({ ...CATALOG, entries: [{ ...ENTRY, observedAt: 'yesterday' }] }).ok).toBe(false);
  });

  it('rejects non-objects and missing stores', () => {
    expect(validateCatalog(null).ok).toBe(false);
    expect(validateCatalog({ ...CATALOG, storeId: '' }).ok).toBe(false);
  });

  it('exposes the current version constant', () => {
    expect(CATALOG_VERSION).toBe(1);
  });
});
