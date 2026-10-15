import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './index.js';
import { MemoryCaps, type VisionProvider } from './vision.js';

const IMAGE = btoa('fake-jpeg-bytes');
const NOW = '2026-10-14T12:00:00.000Z';

function mockVision(read: unknown): VisionProvider & { calls: number } {
  const provider = {
    calls: 0,
    modelName: () => 'test-model',
    async readTag(_image: Uint8Array): Promise<unknown> {
      provider.calls += 1;
      return read;
    },
  };
  return provider;
}

function readTag(app: ReturnType<typeof createApp>, body: unknown, ip = '10.0.0.1') {
  return app.request('/prices/read-tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
}

const BODY = { imageBase64: IMAGE, storeId: 'store-demo-1', barcode: '012345678905' };

describe('POST /prices/read-tag', () => {
  let vision: ReturnType<typeof mockVision>;

  beforeEach(() => {
    vision = mockVision({ priceMinor: 125000, name: 'Tastee Cheese 250g', confidence: 0.9 });
    vi.unstubAllGlobals();
  });

  it('reads a tag and stores it with source tag', async () => {
    const app = createApp(undefined, { vision });
    const res = await readTag(app, BODY);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { source: unknown; priceMinor: unknown; label: unknown };
    expect(body.source).toBe('tag');
    expect(body.priceMinor).toBe(125000);
    expect(body.label).toBe('exact');
    expect(vision.calls).toBe(1);
  });

  it('returns unstored reads without a barcode (never corrupts shared data)', async () => {
    const app = createApp(undefined, { vision });
    const { barcode: _dropped, ...noBarcode } = BODY;
    const res = await readTag(app, noBarcode);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stored: unknown; priceMinor: unknown };
    expect(body.stored).toBe(false);
    expect(body.priceMinor).toBe(125000);
  });

  it('rejects oversized images with 413', async () => {
    const app = createApp(undefined, { vision });
    const big = await readTag(app, { ...BODY, imageBase64: 'a'.repeat(2_000_001) });
    expect(big.status).toBe(413);
    expect(vision.calls).toBe(0);
  });

  it('rejects malformed model output with 502 and stores nothing', async () => {
    const bad = mockVision({ priceMinor: 'lots', confidence: 99 });
    const app = createApp(undefined, { vision: bad });
    const res = await readTag(app, BODY);
    expect(res.status).toBe(502);
    const resolve = await app.request('/prices/resolve?storeId=store-demo-1&barcode=012345678905');
    expect(resolve.status).toBe(404);
  });

  it('caps reads per device per day with 429', async () => {
    const caps = new MemoryCaps(2);
    const app = createApp(undefined, { vision, caps });
    // Distinct photos: identical bytes would replay from the photo cache
    // without spending budget (covered below).
    expect((await readTag(app, { ...BODY, imageBase64: btoa('photo-one') })).status).toBe(201);
    expect((await readTag(app, { ...BODY, imageBase64: btoa('photo-two') })).status).toBe(201);
    expect((await readTag(app, { ...BODY, imageBase64: btoa('photo-three') })).status).toBe(429);
    expect(vision.calls).toBe(2);
  });

  it('replays identical photos without a model call', async () => {
    const app = createApp(undefined, { vision });
    expect((await readTag(app, BODY)).status).toBe(201);
    const replay = await readTag(app, BODY);
    expect(replay.status).toBe(200);
    const body = (await replay.json()) as { cached: unknown; stored: unknown; priceMinor: unknown };
    expect(body.cached).toBe(true);
    expect(body.stored).toBe(true);
    expect(body.priceMinor).toBe(125000);
    expect(vision.calls).toBe(1);
  });

  it('replays do not spend daily budget', async () => {
    const caps = new MemoryCaps(1);
    const app = createApp(undefined, { vision, caps });
    expect((await readTag(app, BODY)).status).toBe(201);
    expect((await readTag(app, BODY)).status).toBe(200);
    expect(vision.calls).toBe(1);
  });

  it('stores a replay once a barcode arrives for a barcode-less read', async () => {
    const app = createApp(undefined, { vision });
    const { barcode: _dropped, ...noBarcode } = BODY;
    expect(((await readTag(app, noBarcode)).status)).toBe(200);
    const stored = await readTag(app, BODY);
    expect(stored.status).toBe(201);
    const body = (await stored.json()) as { cached: unknown; stored: unknown };
    expect(body.cached).toBe(true);
    expect(body.stored).toBe(true);
    expect(vision.calls).toBe(1);
    expect((await app.request('/prices/resolve?storeId=store-demo-1&barcode=012345678905')).status).toBe(200);
  });

  it('does not replay across stores', async () => {
    const app = createApp(undefined, { vision });
    expect((await readTag(app, BODY)).status).toBe(201);
    const other = await readTag(app, { ...BODY, storeId: 'store-demo-2' });
    expect(other.status).toBe(201);
    expect(((await other.json()) as { cached: unknown }).cached).toBeUndefined();
    expect(vision.calls).toBe(2);
  });

  it('rejects anonymous-forbidden keys with 400', async () => {
    const app = createApp(undefined, { vision });
    const res = await readTag(app, { ...BODY, userId: 'u1' });
    expect(res.status).toBe(400);
    expect(vision.calls).toBe(0);
  });

  it('returns 502 when the provider throws, without leaking details', async () => {
    const boom: VisionProvider = {
      modelName: () => 'test-model',
      async readTag(): Promise<unknown> {
        throw new Error('sk-ant-secret-key-material');
      },
    };
    const app = createApp(undefined, { vision: boom });
    const res = await readTag(app, BODY);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('sk-ant');
  });
});
