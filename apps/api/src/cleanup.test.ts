import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { authSession, authUser } from './auth-schema.js';
import { cleanupExpiredAuth } from './cleanup.js';
import { openDb } from './db.js';

const DATABASE_URL = process.env.DATABASE_URL;
const NS = `test-cleanup-${Date.now()}`;

/**
 * Neon integration: expired sessions/verifications go, live ones stay, and
 * anonymous users with no sessions are reaped. Skipped without DATABASE_URL.
 */
(DATABASE_URL ? describe : describe.skip)('cleanupExpiredAuth (Neon)', () => {
  it('sweeps only what is expired or orphaned', async () => {
    const db = openDb(DATABASE_URL!);
    const uid = (s: string) => `${NS}-${s}`;
    const past = new Date('2000-01-01T00:00:00.000Z');
    const future = new Date('2100-01-01T00:00:00.000Z');
    try {
      await db.execute(sql`insert into auth_user(id, name, email, is_anonymous) values
        (${uid('gone')}, 'Gone', ${uid('gone') + '@x.test'}, true),
        (${uid('live')}, 'Live', ${uid('live') + '@x.test'}, true)`);
      await db.execute(sql`insert into auth_session(id, expires_at, token, user_id) values
        (${uid('s-gone')}, ${past}, ${uid('tok-gone')}, ${uid('gone')}),
        (${uid('s-live')}, ${future}, ${uid('tok-live')}, ${uid('live')})`);
      await db.execute(sql`insert into auth_verification(id, identifier, value, expires_at) values
        (${uid('v-gone')}, 'gone', 'v', ${past}),
        (${uid('v-live')}, 'live', 'v', ${future})`);

      const counts = await cleanupExpiredAuth(db, new Date('2026-10-15T00:00:00.000Z'));
      expect(counts.sessions).toBe(1);
      expect(counts.verifications).toBe(1);
      expect(counts.users).toBe(1);

      const sessions = await db.select().from(authSession);
      expect(sessions.map((s) => s.id)).toEqual([uid('s-live')]);
      const users = await db.select().from(authUser).where(eq(authUser.id, uid('live')));
      expect(users.length).toBe(1);
    } finally {
      await db.execute(sql`delete from auth_session where user_id like ${NS + '%'}`);
      await db.execute(sql`delete from auth_account where user_id like ${NS + '%'}`);
      await db.execute(sql`delete from auth_verification where id like ${NS + '%'}`);
      await db.execute(sql`delete from auth_user where id like ${NS + '%'}`);
    }
  });
});
