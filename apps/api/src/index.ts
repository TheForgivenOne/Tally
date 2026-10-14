import { labelFor, resolvePrice } from '@tally/shared';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { MemoryPriceStore, type PriceStore } from './store.js';

/** Keys that must never appear on shared routes. Anonymous data only. */
const FORBIDDEN_KEYS = new Set([
  'userId',
  'deviceId',
  'user_id',
  'device_id',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'coords',
  'coordinates',
]);

const reportSchema = z
  .object({
    storeId: z.string().min(1),
    barcode: z.string().min(1),
    name: z.string().min(1).optional(),
    brand: z.string().optional(),
    size: z.string().optional(),
    priceMinor: z.number().int().positive(),
    source: z.enum(['cache', 'tag', 'barcode-cache', 'web', 'ai']),
    observedAt: z.string().datetime(),
    confidence: z.number().min(0).max(1),
    promo: z.boolean().optional(),
  })
  .strict();

const resolveQuerySchema = z.object({
  storeId: z.string().min(1),
  barcode: z.string().min(1),
});

export function createApp(store: PriceStore = new MemoryPriceStore()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/prices/report', async (c) => {
    const raw: unknown = await c.req.json().catch(() => undefined);
    if (typeof raw !== 'object' || raw === null) {
      return c.json({ message: 'Request body must be a JSON object' }, 400);
    }
    const leaked = Object.keys(raw).filter((k) => FORBIDDEN_KEYS.has(k));
    if (leaked.length > 0) {
      return c.json({ message: `Shared price data is anonymous: remove ${leaked.join(', ')}` }, 400);
    }
    const parsed = reportSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ message: 'Invalid price report' }, 400);
    }
    const stored = store.add(parsed.data);
    return c.json(stored, 201);
  });

  app.get('/prices/resolve', zValidator('query', resolveQuerySchema), (c) => {
    const { storeId, barcode } = c.req.valid('query');
    const winner = resolvePrice(store.list(storeId, barcode));
    if (!winner) return c.json({ message: 'No price known for this product at this store' }, 404);
    return c.json({
      priceMinor: winner.priceMinor,
      source: winner.source,
      observedAt: winner.observedAt,
      confidence: winner.confidence,
      label: labelFor(winner.source),
      // Stub: true once 2+ matching reports agree. See consensus derivation (step 2b).
      consensus: false,
    });
  });

  app.notFound((c) => c.json({ message: 'Not Found' }, 404));
  app.onError((err, c) => {
    console.error(JSON.stringify({ message: 'request failed', error: String(err) }));
    return c.json({ message: 'Internal Server Error' }, 500);
  });

  return app;
}

const app = createApp();

export type AppType = typeof app;

export default app;
