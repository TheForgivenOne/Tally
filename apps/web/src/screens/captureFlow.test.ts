import { describe, expect, it, vi } from 'vitest';
import { captureFlow, type CaptureDeps } from './captureFlow.js';

const IMAGE = 'base64-frame';

function deps(overrides: Partial<CaptureDeps> = {}): CaptureDeps & { calls: string[] } {
  const calls: string[] = [];
  const decode = overrides.decodeBarcode ?? (async () => null);
  const resolve = overrides.resolvePrice ?? (async () => null);
  const read = overrides.readTag ?? (async () => null);
  return {
    calls,
    decodeBarcode: async () => {
      calls.push('decode');
      return decode();
    },
    resolvePrice: async (barcode) => {
      calls.push('resolve');
      return resolve(barcode);
    },
    readTag: async (image, barcode) => {
      calls.push('readTag');
      return read(image, barcode);
    },
  };
}

const RESOLVED = {
  barcode: '012345678905',
  name: 'Tastee Cheese 250g',
  priceMinor: 125000,
  source: 'cache' as const,
  observedAt: '2026-10-14T12:00:00.000Z',
  confidence: 0.9,
};

const TAG_READ = {
  barcode: '',
  name: 'Tastee Cheese 250g',
  priceMinor: 125000,
  source: 'tag' as const,
  observedAt: '2026-10-14T12:00:00.000Z',
  confidence: 0.85,
  stored: false,
};

describe('captureFlow', () => {
  it('decodes a barcode and resolves the cached price without reading the tag', async () => {
    const d = deps({
      decodeBarcode: async () => '012345678905',
      resolvePrice: async () => RESOLVED,
    });
    const outcome = await captureFlow(IMAGE, d);
    expect(outcome).toEqual({ kind: 'resolved', item: RESOLVED });
    expect(d.calls).toEqual(['decode', 'resolve']);
  });

  it('falls through to the tag photo when the barcode resolves to nothing', async () => {
    const d = deps({
      decodeBarcode: async () => '012345678905',
      resolvePrice: async () => null,
      readTag: async () => TAG_READ,
    });
    const outcome = await captureFlow(IMAGE, d);
    expect(outcome.kind).toBe('tag');
    expect(d.calls).toEqual(['decode', 'resolve', 'readTag']);
  });

  it('skips resolve and reads the tag when no barcode decodes', async () => {
    const d = deps({ readTag: async () => TAG_READ });
    const outcome = await captureFlow(IMAGE, d);
    expect(outcome.kind).toBe('tag');
    expect(d.calls).toEqual(['decode', 'readTag']);
  });

  it('reports failure when every stage fails', async () => {
    const d = deps();
    expect(await captureFlow(IMAGE, d)).toEqual({ kind: 'failed' });
  });

  it('passes the decoded barcode to the tag read so it stores', async () => {
    let seen: string | undefined;
    const d = deps({
      decodeBarcode: async () => '012345678905',
      resolvePrice: async () => null,
      readTag: async (_image, barcode) => {
        seen = barcode;
        return { ...TAG_READ, barcode: barcode ?? '' };
      },
    });
    await captureFlow(IMAGE, d);
    expect(seen).toBe('012345678905');
  });
});
