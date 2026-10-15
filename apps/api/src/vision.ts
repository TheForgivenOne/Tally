/** Test seam: routes depend on this, Gemini (or the in-house reader) implements it. */
export interface VisionProvider {
  /** Raw model output. The route validates it via shared `validateTagRead`. */
  readTag(image: Uint8Array, mimeType: string): Promise<unknown>;
  /** Model id for audit rows (e.g. 'gemini-2.0-flash', 'test-model'). */
  modelName(): string;
}

/** Per-day spend of a capped resource. Memory for tests/dev, Postgres in prod. */
export interface Caps {
  /** Consume one unit for `key`, false when the daily limit is reached. */
  take(key: string): Promise<boolean>;
}

/** A cached tag read: the same photo bytes replay without a model call. */
export interface CachedTagRead {
  storeId: string;
  barcode: string | null;
  name: string | null;
  priceMinor: number;
  confidence: number;
  model: string;
  observedAt: string;
}

export interface NewTagRead extends CachedTagRead {
  imageHash: string;
}

/** Photo cache. Memory for tests/dev, Postgres in prod. */
export interface PhotoCache {
  /** A fresh (≤30d) read for these exact photo bytes, or null. */
  lookup(imageHash: string): Promise<CachedTagRead | null>;
  /** Persist a validated read for audit + future replays. Failures must not throw. */
  save(read: NewTagRead): Promise<void>;
}

/** Freshness window for photo replays. Tunable; prices move, tags fade. */
export const PHOTO_CACHE_DAYS = 30;

/** In-memory photo cache. Resets on restart — prod uses DrizzlePhotoCache. */
export class MemoryPhotoCache implements PhotoCache {
  private rows = new Map<string, { read: CachedTagRead; at: number }>();

  async lookup(imageHash: string): Promise<CachedTagRead | null> {
    const hit = this.rows.get(imageHash);
    if (!hit) return null;
    if (Date.now() - hit.at > PHOTO_CACHE_DAYS * 86_400_000) {
      this.rows.delete(imageHash);
      return null;
    }
    return hit.read;
  }

  async save(read: NewTagRead): Promise<void> {
    const { imageHash, ...rest } = read;
    this.rows.set(imageHash, { read: rest, at: Date.now() });
  }
}
/** In-memory per-day caps. Resets on restart — prod uses DrizzleCaps. */
export class MemoryCaps implements Caps {
  private counts = new Map<string, number>();

  constructor(private readonly limitPerDay: number = 50) {}

  async take(key: string): Promise<boolean> {
    const used = this.counts.get(key) ?? 0;
    if (used >= this.limitPerDay) return false;
    this.counts.set(key, used + 1);
    return true;
  }
}

export interface OpenAICompatEnv {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Vision over any OpenAI-compatible chat-completions endpoint —
 * including Gemini's (`.../v1beta/openai/`). Plain fetch, no SDK.
 */
export class OpenAICompatibleVision implements VisionProvider {
  constructor(private readonly env: OpenAICompatEnv) {}

  modelName(): string {
    return this.env.model;
  }

  async readTag(image: Uint8Array, mimeType: string): Promise<unknown> {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < image.length; i += chunk) {
      binary += String.fromCharCode(...image.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const res = await fetch(`${this.env.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.env.apiKey}` },
      body: JSON.stringify({
        model: this.env.model,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Read this Jamaican supermarket shelf tag. Reply with JSON only: {"priceMinor": <integer minor units, e.g. cents>, "name": "<product name if visible>", "confidence": <0-1>}. If no price is readable, reply {"priceMinor": 0, "confidence": 0}.',
              },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Vision backend rejected the request (${res.status})`);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) throw new Error('Vision backend returned no content');
    return JSON.parse(content) as unknown;
  }
}
