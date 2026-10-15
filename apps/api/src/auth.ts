import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins';
import type { NeonDb } from './db.js';
import { authAccount, authSession, authUser, authVerification } from './auth-schema.js';

export interface AuthEnv {
  /** Never commit a value — `wrangler secret put BETTER_AUTH_SECRET` in prod. */
  secret: string;
  /** Public origin of the deployed API (cookies anchor here). */
  baseURL?: string;
  /** Web origins allowed to use cookies (explicit — never `*` with credentials). */
  trustedOrigins?: string[];
}

/**
 * Anonymous-device auth only. No passwords, no emails, no personal data:
 * each device gets a random user id used solely for per-device rate limits.
 * The id never appears in the shared price tables.
 */
export function createAuth(db: NeonDb, env: AuthEnv) {
  return betterAuth({
    secret: env.secret,
    ...(env.baseURL ? { baseURL: env.baseURL } : {}),
    ...(env.trustedOrigins ? { trustedOrigins: env.trustedOrigins } : {}),
    database: drizzleAdapter(db, {
      provider: 'pg',
      // Model keys stay canonical; table names keep the auth_ prefix so
      // auth storage is visibly separate from the shared price tables.
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    plugins: [anonymous()],
    session: {
      // Anonymous device sessions are cheap to mint; a week avoids
      // re-sign-in churn while staying short-lived.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
}

export type TallyAuth = ReturnType<typeof createAuth>;
