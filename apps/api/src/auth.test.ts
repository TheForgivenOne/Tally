import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createAuth } from './auth.js';
import { DrizzlePriceStore, openDb } from './db.js';
import { createApp } from './index.js';
import { MemoryPriceStore } from './store.js';
import { MemoryCaps, type VisionProvider } from './vision.js';

const IMAGE = btoa('fake-jpeg-bytes');
const BARCODE = '012345678905';
const STORE = 'store-caps-check';

function stubVision(): VisionProvider {
  return { readTag: async () => ({ priceMinor: 125000, name: 'Caps Check', confidence: 0.9 }) };
}

const DATABASE_URL = process.env.DATABASE_URL;

describe('auth routes without auth configured', () => {
  it('returns JSON 404 (caps fall back to IP)', async () => {
    const res = await createApp(new MemoryPriceStore()).request('/api/auth/get-session');
    expect(res.status).toBe(404);
  });
});

(DATABASE_URL ? describe : describe.skip)('anonymous devices (Neon)', () => {
  it('signs a device in anonymously and reads its session back', async () => {
    const db = openDb(DATABASE_URL!);
    const secret = `test-secret-${Date.now()}`;
    const app = createApp(new DrizzlePriceStore(db), { auth: createAuth(db, { secret }) });
    let userId = '';

    try {
      const signIn = await app.request('http://localhost/api/auth/sign-in/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(signIn.status).toBe(200);
      const cookie = signIn.headers.get('set-cookie');
      expect(cookie).toMatch(/better-auth\.session_token=/);
      const sessionCookie = cookie!.split(';')[0]!;

      const session = await app.request('http://localhost/api/auth/get-session', {
        headers: { cookie: sessionCookie },
      });
      expect(session.status).toBe(200);
      const body = (await session.json()) as { user: { id: unknown } };
      expect(body.user.id).toBeTypeOf('string');
      userId = body.user.id as string;
    } finally {
      if (userId) {
        await db.execute(sql`delete from auth_session where user_id = ${userId}`);
        await db.execute(sql`delete from auth_account where user_id = ${userId}`);
        await db.execute(sql`delete from auth_user where id = ${userId}`);
      }
    }
  });

  it('caps tag reads per device, not per IP', async () => {
    const db = openDb(DATABASE_URL!);
    const app = createApp(new DrizzlePriceStore(db), {
      auth: createAuth(db, { secret: `test-secret-${Date.now()}` }),
      vision: stubVision(),
      caps: new MemoryCaps(1),
    });
    let userId = '';
    const tagBody = { imageBase64: IMAGE, storeId: STORE, barcode: BARCODE };
    const json = { 'Content-Type': 'application/json' };
    try {
      const signIn = await app.request('http://localhost/api/auth/sign-in/anonymous', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({}),
      });
      expect(signIn.status).toBe(200);
      const sessionCookie = signIn.headers.get('set-cookie')!.split(';')[0]!;
      const authed = { ...json, cookie: sessionCookie };
      const me = (await (await app.request('http://localhost/api/auth/get-session', { headers: authed })).json()) as { user: { id: string } };
      userId = me.user.id;

      const first = await app.request('/prices/read-tag', { method: 'POST', headers: authed, body: JSON.stringify(tagBody) });
      expect(first.status).toBe(201);
      // Same device, second read: capped even from a fresh IP.
      const second = await app.request('/prices/read-tag', {
        method: 'POST',
        headers: { ...authed, 'cf-connecting-ip': '9.9.9.9' },
        body: JSON.stringify(tagBody),
      });
      expect(second.status).toBe(429);
      // A sessionless device on another IP keeps its own budget.
      const stranger = await app.request('/prices/read-tag', {
        method: 'POST',
        headers: { ...json, 'cf-connecting-ip': '8.8.8.8' },
        body: JSON.stringify(tagBody),
      });
      expect(stranger.status).toBe(201);
    } finally {
      await db.execute(sql`delete from current_prices where store_id = ${STORE}`);
      await db.execute(sql`delete from price_observations where store_id = ${STORE}`);
      await db.execute(sql`delete from products where barcode = ${BARCODE}`);
      await db.execute(sql`delete from stores where id = ${STORE}`);
      if (userId) {
        await db.execute(sql`delete from auth_session where user_id = ${userId}`);
        await db.execute(sql`delete from auth_account where user_id = ${userId}`);
        await db.execute(sql`delete from auth_user where id = ${userId}`);
      }
    }
  });
});
