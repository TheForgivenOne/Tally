import { describe, expect, it } from 'vitest';
import { createApp } from './index.js';

const REPORT = {
  storeId: 'store-demo-1',
  barcode: '012345678905',
  name: 'Tastee Cheese 250g',
  priceMinor: 125000,
  source: 'tag',
  observedAt: '2026-10-14T12:00:00.000Z',
  confidence: 0.95,
};

async function postReport(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request('/prices/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await createApp().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /prices/report', () => {
  it('accepts a valid anonymous report', async () => {
    const res = await postReport(createApp(), REPORT);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: unknown; source: unknown };
    expect(body.id).toBeTypeOf('string');
    expect(body.source).toBe('tag');
  });

  it.each([['userId', { ...REPORT, userId: 'u1' }], ['deviceId', { ...REPORT, deviceId: 'd1' }], ['coordinates', { ...REPORT, latitude: 18.47, longitude: -77.92 }]])(
    'rejects reports carrying %s with 400',
    async (_label, body) => {
      const res = await postReport(createApp(), body);
      expect(res.status).toBe(400);
    },
  );

  it('rejects invalid prices and sources with 400', async () => {
    const app = createApp();
    for (const body of [
      { ...REPORT, priceMinor: -5 },
      { ...REPORT, source: 'guess' },
      { ...REPORT, storeId: '' },
      { ...REPORT, observedAt: 'not-a-date' },
    ]) {
      expect((await postReport(app, body)).status).toBe(400);
    }
  });
});

describe('GET /prices/resolve', () => {
  it('prefers cache over web and labels them exact vs estimated', async () => {
    const app = createApp();
    await postReport(app, { ...REPORT, source: 'web', priceMinor: 130000, confidence: 0.6 });
    await postReport(app, { ...REPORT, source: 'cache', priceMinor: 125000, confidence: 0.9 });
    const res = await app.request('/prices/resolve?storeId=store-demo-1&barcode=012345678905');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { source: unknown; priceMinor: unknown; label: unknown; consensus: unknown; name: unknown };
    expect(body.source).toBe('cache');
    expect(body.priceMinor).toBe(125000);
    expect(body.label).toBe('exact');
    expect(body.consensus).toBe(false);
    expect(body.name).toBe('Tastee Cheese 250g');
  });

  it('labels AI estimates as estimated', async () => {
    const app = createApp();
    await postReport(app, { ...REPORT, source: 'ai', priceMinor: 140000, confidence: 0.4 });
    const res = await app.request('/prices/resolve?storeId=store-demo-1&barcode=012345678905');
    const body = (await res.json()) as { source: unknown; label: unknown };
    expect(body.source).toBe('ai');
    expect(body.label).toBe('estimated');
  });

  it('returns 404 when nothing is known for the product', async () => {
    const res = await createApp().request('/prices/resolve?storeId=store-demo-1&barcode=000000000000');
    expect(res.status).toBe(404);
  });

  it('requires storeId and barcode', async () => {
    expect((await createApp().request('/prices/resolve')).status).toBe(400);
  });
});

describe('GET /catalog/:storeId', () => {
  it('serves one winning entry per product in contract shape', async () => {
    const app = createApp();
    await postReport(app, { ...REPORT, source: 'ai', priceMinor: 140000, confidence: 0.4 });
    await postReport(app, { ...REPORT, source: 'tag', priceMinor: 125000, confidence: 0.95 });
    const res = await app.request('/catalog/store-demo-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      version: unknown;
      storeId: unknown;
      generatedAt: unknown;
      entries: Array<{ barcode: unknown; name: unknown; priceMinor: unknown; source: unknown }>;
    };
    expect(body.version).toBe(1);
    expect(body.storeId).toBe('store-demo-1');
    expect(body.entries.length).toBe(1);
    expect(body.entries[0]?.source).toBe('tag');
    expect(body.entries[0]?.priceMinor).toBe(125000);
  });

  it('returns an empty catalog for an unknown store', async () => {
    const res = await createApp().request('/catalog/store-nope');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { entries: unknown[] }).entries).toEqual([]);
  });
});

describe('unknown routes', () => {
  it('returns JSON 404', async () => {
    const res = await createApp().request('/nope');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { message: unknown }).message).toBeTypeOf('string');
  });
});
