import { createAuthClient } from 'better-auth/react';
import { anonymousClient } from 'better-auth/client/plugins';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

/**
 * Anonymous-device session client. Credentials ride along so the session
 * cookie works when the PWA and the API live on different origins;
 * same-origin deployments are unaffected.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE,
  plugins: [anonymousClient()],
  fetchOptions: { credentials: 'include' },
});

/**
 * Best-effort anonymous sign-in at startup. Establishes the device session
 * the API uses for per-device tag-read caps. Never gates the app: offline
 * or unconfigured servers simply keep IP-keyed caps.
 */
export async function ensureDeviceSession(): Promise<void> {
  try {
    const { data } = await authClient.getSession();
    if (data?.user) return;
    await authClient.signIn.anonymous();
  } catch {
    // Offline, or auth not deployed — the app works regardless.
  }
}
