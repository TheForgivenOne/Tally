import { labelFor, resolvePrice, validateTagRead } from '@tally/shared';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { MemoryPriceStore, type PriceStore } from './store.js';
import { MemoryCaps, OpenAICompatibleVision, type VisionProvider } from './vision.js';

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

type Bindings = Cloudflare.Env & {
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  VISION_MODEL?: string;
};

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const DEFAULT_MODEL = 'gemini-2.0-flash';

/** ~1.5MB of JPEG. Larger payloads are rejected before any model call. */
const MAX_IMAGE_BASE64_CHARS = 2_000_000;

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

const readTagSchema = z
  .object({
    storeId: z.string().min(1),
    barcode: z.string().min(1).optional(),
    imageBase64: z.string().min(1),
  })
  .strict();

function forbiddenKeys(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null) return [];
  return Object.keys(raw).filter((k) => FORBIDDEN_KEYS.has(k));
}

export interface ApiDeps {
  vision?: VisionProvider;
  caps?: MemoryCaps;
}

export function createApp(store: PriceStore = new MemoryPriceStore(), deps: ApiDeps = {}) {
  const app = new Hono<{ Bindings: Bindings }>();
  const caps = deps.caps ?? new MemoryCaps();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/prices/report', async (c) => {
    const raw: unknown = await c.req.json().catch(() => undefined);
    if (typeof raw !== 'object' || raw === null) {
      return c.json({ message: 'Request body must be a JSON object' }, 400);
    }
    const leaked = forbiddenKeys(raw);
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
      barcode,
      name: winner.name,
      brand: winner.brand,
      priceMinor: winner.priceMinor,
      source: winner.source,
      observedAt: winner.observedAt,
      confidence: winner.confidence,
      label: labelFor(winner.source),
      // Stub: true once 2+ matching reports agree. See consensus derivation (step 2b).
      consensus: false,
    });
  });

  app.post('/prices/read-tag', async (c) => {
    const raw: unknown = await c.req.json().catch(() => undefined);
    if (typeof raw !== 'object' || raw === null) {
      return c.json({ message: 'Request body must be a JSON object' }, 400);
    }
    const leaked = forbiddenKeys(raw);
    if (leaked.length > 0) {
      return c.json({ message: `Shared price data is anonymous: remove ${leaked.join(', ')}` }, 400);
    }
    const parsed = readTagSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ message: 'Invalid tag-read request' }, 400);
    }
    if (parsed.data.imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return c.json({ message: 'Image too large — resize in the browser first' }, 413);
    }

    const ip = c.req.header('cf-connecting-ip') ?? 'anon';
    const day = new Date().toISOString().slice(0, 10);
    if (!caps.take(`${ip}:${day}`)) {
      return c.json({ message: 'Daily tag-read limit reached' }, 429);
    }

    const vision =
      deps.vision ??
      (c.env.OPENAI_API_KEY
        ? new OpenAICompatibleVision({
            baseUrl: c.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL,
            apiKey: c.env.OPENAI_API_KEY,
            model: c.env.VISION_MODEL ?? DEFAULT_MODEL,
          })
        : undefined);
    if (!vision) {
      return c.json({ message: 'Tag reading is not configured' }, 503);
    }

    let bytes: Uint8Array;
    try {
      const binary = atob(parsed.data.imageBase64);
      bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    } catch {
      return c.json({ message: 'Invalid tag-read request' }, 400);
    }

    let modelOutput: unknown;
    try {
      modelOutput = await vision.readTag(bytes, 'image/jpeg');
    } catch {
      // Generic on purpose: never leak backend details (keys, URLs) to clients.
      return c.json({ message: 'Tag read failed — retake the photo and try again' }, 502);
    }
    const checked = validateTagRead(modelOutput);
    if (!checked.ok) {
      return c.json({ message: 'Tag read failed — retake the photo and try again' }, 502);
    }

    // Bytes go out of scope here — images are never stored, whole or cropped.
    // Without a barcode the read cannot join the shared dataset (one bogus
    // key would corrupt every product), so it returns unstored for the local
    // basket only. Barcode decode lands in step 6.
    if (!parsed.data.barcode) {
      return c.json(
        {
          barcode: '',
          name: checked.read.name ?? 'Shelf item',
          priceMinor: checked.read.priceMinor,
          source: 'tag',
          observedAt: new Date().toISOString(),
          confidence: checked.read.confidence,
          label: labelFor('tag'),
          stored: false,
        },
        200,
      );
    }
    const stored = store.add({
      storeId: parsed.data.storeId,
      barcode: parsed.data.barcode,
      name: checked.read.name,
      priceMinor: checked.read.priceMinor,
      source: 'tag',
      observedAt: new Date().toISOString(),
      confidence: checked.read.confidence,
    });
    return c.json({ ...stored, label: labelFor('tag'), stored: true }, 201);
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
