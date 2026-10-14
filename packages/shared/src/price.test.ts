import { describe, expect, it } from 'vitest';
import {
  REGISTER_DISCLAIMER,
  canOverwrite,
  errorBand,
  labelFor,
  priceRange,
  resolvePrice,
  type PriceObservation,
} from './price.js';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString();

function obs(partial: Partial<PriceObservation> & { source: PriceObservation['source'] }): PriceObservation {
  return {
    priceMinor: 1000,
    observedAt: iso(1),
    confidence: 0.9,
    ...partial,
  };
}

describe('resolvePrice', () => {
  it('uses the cache price when only cache, web, and AI observations exist', () => {
    const result = resolvePrice(
      [obs({ source: 'ai', priceMinor: 900 }), obs({ source: 'web', priceMinor: 950 }), obs({ source: 'cache', priceMinor: 1000 })]);
    expect(result?.source).toBe('cache');
    expect(result?.priceMinor).toBe(1000);
  });

  it('prefers a fresh tag read over a cached price', () => {
    const result = resolvePrice([obs({ source: 'cache' }), obs({ source: 'tag' })]);
    expect(result?.source).toBe('tag');
  });

  it('treats barcode-cache like cache and prefers it over web and AI', () => {
    const result = resolvePrice(
      [obs({ source: 'ai' }), obs({ source: 'web' }), obs({ source: 'barcode-cache', priceMinor: 1000 })]);
    expect(result?.source).toBe('barcode-cache');
  });

  it('breaks rank ties by newest observation', () => {
    const result = resolvePrice(
      [obs({ source: 'cache', observedAt: iso(5) }), obs({ source: 'cache', observedAt: iso(1), priceMinor: 1100 })]);
    expect(result?.priceMinor).toBe(1100);
  });

  it('returns undefined when there are no observations', () => {
    expect(resolvePrice([])).toBeUndefined();
  });
});

describe('canOverwrite', () => {
  it('never lets a web price overwrite a cached price', () => {
    expect(canOverwrite(obs({ source: 'cache' }), obs({ source: 'web' }))).toBe(false);
  });

  it('never lets an AI estimate overwrite a tag read', () => {
    expect(canOverwrite(obs({ source: 'tag' }), obs({ source: 'ai' }))).toBe(false);
  });

  it('lets a fresh tag read overwrite a cached price', () => {
    expect(canOverwrite(obs({ source: 'cache' }), obs({ source: 'tag' }))).toBe(true);
  });

  it('lets a newer observation overwrite an equal-rank older one', () => {
    expect(canOverwrite(obs({ source: 'cache', observedAt: iso(5) }), obs({ source: 'cache', observedAt: iso(1) }))).toBe(true);
  });
});

describe('errorBand', () => {
  it('gives a recent tag read ±2%', () => {
    expect(errorBand(obs({ source: 'tag', observedAt: iso(1) }), NOW)).toBe(0.02);
  });

  it('gives a recent cache price ±5% and an older one ±10%', () => {
    expect(errorBand(obs({ source: 'cache', observedAt: iso(1) }), NOW)).toBe(0.05);
    expect(errorBand(obs({ source: 'cache', observedAt: iso(30) }), NOW)).toBe(0.1);
  });

  it('gives web reference prices ±10% and AI estimates ±25%', () => {
    expect(errorBand(obs({ source: 'web' }), NOW)).toBe(0.1);
    expect(errorBand(obs({ source: 'ai' }), NOW)).toBe(0.25);
  });
});

describe('labelFor', () => {
  it('marks tag and cache reads exact, web and AI estimated', () => {
    expect(labelFor('tag')).toBe('exact');
    expect(labelFor('cache')).toBe('exact');
    expect(labelFor('barcode-cache')).toBe('exact');
    expect(labelFor('web')).toBe('estimated');
    expect(labelFor('ai')).toBe('estimated');
  });
});

describe('priceRange', () => {
  it('sums bands across items and always includes the register disclaimer', () => {
    const items = [
      { observation: obs({ source: 'tag', priceMinor: 1000, observedAt: iso(1) }), quantity: 2 },
      { observation: obs({ source: 'ai', priceMinor: 2000 }), quantity: 1 },
    ];
    // tag ±2% of 2000 = ±40; ai ±25% of 2000 = ±500 → [3460, 4540]
    const range = priceRange(items, NOW);
    expect(range.minMinor).toBe(3460);
    expect(range.maxMinor).toBe(4540);
    expect(range.disclaimer).toBe(REGISTER_DISCLAIMER);
  });

  it('rounds bounds to whole minor units', () => {
    const range = priceRange([{ observation: obs({ source: 'web', priceMinor: 999 }), quantity: 1 }], NOW);
    expect(Number.isInteger(range.minMinor)).toBe(true);
    expect(Number.isInteger(range.maxMinor)).toBe(true);
  });
});
