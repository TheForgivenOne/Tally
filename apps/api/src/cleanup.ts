import { and, eq, isNull, lt } from 'drizzle-orm';
import { authAccount, authSession, authUser, authVerification } from './auth-schema.js';
import type { NeonDb } from './db.js';

export interface CleanupCounts {
  sessions: number;
  verifications: number;
  users: number;
  accounts: number;
}

/**
 * Delete expired auth rows: sessions, verifications, and anonymous users
 * left with no sessions (plus their accounts). Anonymous ids are random
 * and never join the price tables, so deletion is always safe — nothing
 * else references them. Runs daily from the Worker's scheduled handler.
 */
export async function cleanupExpiredAuth(db: NeonDb, now: Date = new Date()): Promise<CleanupCounts> {
  const expiredSessions = await db
    .delete(authSession)
    .where(lt(authSession.expiresAt, now))
    .returning({ id: authSession.id });
  const expiredVerifications = await db
    .delete(authVerification)
    .where(lt(authVerification.expiresAt, now))
    .returning({ id: authVerification.id });

  // Anonymous users with no remaining sessions are abandoned devices.
  const orphaned = await db
    .select({ id: authUser.id })
    .from(authUser)
    .leftJoin(authSession, eq(authSession.userId, authUser.id))
    .where(and(eq(authUser.isAnonymous, true), isNull(authSession.id)));
  let users = 0;
  let accounts = 0;
  for (const row of orphaned) {
    const goneAccounts = await db
      .delete(authAccount)
      .where(eq(authAccount.userId, row.id))
      .returning({ id: authAccount.id });
    accounts += goneAccounts.length;
    const goneUsers = await db
      .delete(authUser)
      .where(eq(authUser.id, row.id))
      .returning({ id: authUser.id });
    users += goneUsers.length;
  }
  return {
    sessions: expiredSessions.length,
    verifications: expiredVerifications.length,
    users,
    accounts,
  };
}
