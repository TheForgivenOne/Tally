import { labelFor, resolvePrice, validateCatalog, validateTagRead } from '@tally/shared';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { createAuth, type TallyAuth } from './auth.js';
import { cleanupExpiredAuth } from './cleanup.js';
import { MemoryPriceStore, type PriceStore } from './store.js';
import { DrizzleCaps, DrizzlePriceStore, openDb } from './db.js';
import { MemoryCaps, OpenAICompatibleVision, type Caps, type VisionProvider } from './vision.js';

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
  /** Neon connection string. Set via `wrangler secret put DATABASE_URL` (never in source). */
  DATABASE_URL?: string;
  /** Session signing secret. Set via `wrangler secret put BETTER_AUTH_SECRET`. */
  BETTER_AUTH_SECRET?: string;
  /** Public origin of this API (cookie anchor). */
  BETTER_AUTH_URL?: string;
  /** Comma-separated web origins allowed cookie auth (explicit — never `*`). */
  TRUSTED_ORIGINS?: string;
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
  caps?: Caps;
  /** Anonymous-device auth. When absent, auth routes 404 and caps fall back to IP. */
  auth?: TallyAuth;
  /** Explicit web origins for cookie CORS (mirrors BETTER_AUTH trustedOrigins). */
  authOrigins?: string[];
}

export function createApp(store: PriceStore = new MemoryPriceStore(), deps: ApiDeps = {}) {
  const app = new Hono<{ Bindings: Bindings }>();
  const caps = deps.caps ?? new MemoryCaps();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  if (deps.auth) {
    if (deps.authOrigins && deps.authOrigins.length > 0) {
      app.use('/api/auth/*', cors({ origin: deps.authOrigins, credentials: true }));
    }
    app.all('/api/auth/*', (c) => deps.auth!.handler(c.req.raw));
  }

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
    const stored = await store.add(parsed.data);
    return c.json(stored, 201);
  });

  app.get('/prices/resolve', zValidator('query', resolveQuerySchema), async (c) => {
    const { storeId, barcode } = c.req.valid('query');
    const winner = resolvePrice(await store.list(storeId, barcode));
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

  /**
   * Per-store catalog for offline caching (powers the web outbox flow).
   * Always validated against the shared contract before responding —
   * an empty store yields zero entries, never an error.
   */
  app.get('/catalog/:storeId', async (c) => {
    const storeId = c.req.param('storeId');
    if (!storeId) return c.json({ message: 'Invalid store' }, 400);
    const checked = validateCatalog({
      version: 1,
      storeId,
      generatedAt: new Date().toISOString(),
      entries: await store.catalog(storeId),
    });
    if (!checked.ok) {
      console.error(JSON.stringify({ message: 'catalog contract violation', error: checked.error }));
      return c.json({ message: 'Internal Server Error' }, 500);
    }
    return c.json(checked.catalog);
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
    // Per-device caps when the device holds an anonymous session, else
    // per-IP fallback. The device id is a random auth id — it never
    // appears in the shared price tables.
    let capsKey = `ip:${ip}:${day}`;
    if (deps.auth) {
      const session = await deps.auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
      if (session) capsKey = `device:${session.user.id}:${day}`;
    }
    if (!(await caps.take(capsKey))) {
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
    const stored = await store.add({
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

/**
 * Production entry: one cached Hono app per DATABASE_URL value.
 * With the secret set, every route reads/writes Neon via DrizzlePriceStore;
 * without it (tests, `wrangler dev` with no secret) it falls back to the
 * in-memory store. The cache holds immutable app instances only —
 * no per-request state ever lives at module level.
 */
const appCache = new Map<string, typeof app>();

function appFor(env: Bindings): typeof app {
  const key = `${env.DATABASE_URL ?? 'memory'}|${env.BETTER_AUTH_SECRET ? 'auth' : 'noauth'}`;
  const cached = appCache.get(key);
  if (cached) return cached;
  let built: typeof app;
  if (env.DATABASE_URL) {
    const db = openDb(env.DATABASE_URL);
    const store = new DrizzlePriceStore(db);
    const caps = new DrizzleCaps(db);
    if (env.BETTER_AUTH_SECRET) {
      const origins = (env.TRUSTED_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      built = createApp(store, {
        caps,
        auth: createAuth(db, {
          secret: env.BETTER_AUTH_SECRET,
          ...(env.BETTER_AUTH_URL ? { baseURL: env.BETTER_AUTH_URL } : {}),
          ...(origins.length > 0 ? { trustedOrigins: origins } : {}),
        }),
        ...(origins.length > 0 ? { authOrigins: origins } : {}),
      });
    } else {
      built = createApp(store, { caps });
    }
  } else {
    built = app;
  }
  appCache.set(key, built);
  return built;
}

export default {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return appFor(env).fetch(request, env, ctx);
  },
  /** Daily cron (see [triggers] in wrangler.toml): sweep expired auth rows. */
  async scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    if (!env.DATABASE_URL) return;
    const counts = await cleanupExpiredAuth(openDb(env.DATABASE_URL));
    console.log(JSON.stringify({ message: 'auth cleanup', ...counts }));
  },
};
