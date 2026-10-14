/** Test seam: routes depend on this, Gemini (or the in-house reader) implements it. */
export interface VisionProvider {
  /** Raw model output. The route validates it via shared `validateTagRead`. */
  readTag(image: Uint8Array, mimeType: string): Promise<unknown>;
}

/** In-memory per-day caps. Durable (per-device, persisted) caps land later. */
export class MemoryCaps {
  private counts = new Map<string, number>();

  constructor(private readonly limitPerDay: number = 50) {}

  take(key: string): boolean {
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
