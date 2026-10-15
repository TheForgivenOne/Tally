/**
 * Edge cache seam for hot read endpoints (catalog today). Workers serves
 * from `caches.default`; tests and `wrangler dev` without cache bindings
 * use the in-memory implementation. Freshness is bounded by TTL, not by
 * invalidation — catalogs move slowly (a report per scan) and every client
 * revalidates against Dexie anyway.
 */

/** Freshness window for cached catalogs. Tunable against Neon CU-hours. */
export const CATALOG_CACHE_TTL_SECONDS = 60;

export interface EdgeCache {
  match(key: string): Promise<Response | null>;
  put(key: string, res: Response): Promise<void>;
}

/** In-memory edge cache. Resets on restart — prod uses WorkersEdgeCache. */
export class MemoryEdgeCache implements EdgeCache {
  private rows = new Map<string, { body: string; at: number }>();

  async match(key: string): Promise<Response | null> {
    const hit = this.rows.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CATALOG_CACHE_TTL_SECONDS * 1000) {
      this.rows.delete(key);
      return null;
    }
    return new Response(hit.body, { headers: { 'Content-Type': 'application/json' } });
  }

  async put(key: string, res: Response): Promise<void> {
    this.rows.set(key, { body: await res.text(), at: Date.now() });
  }
}

/** Production edge cache over the Workers Cache API. */
export class WorkersEdgeCache implements EdgeCache {
  async match(key: string): Promise<Response | null> {
    const cache = await caches.open('tally');
    const hit = await cache.match(key);
    return hit ?? null;
  }

  async put(key: string, res: Response): Promise<void> {
    const cache = await caches.open('tally');
    await cache.put(key, res);
  }
}
