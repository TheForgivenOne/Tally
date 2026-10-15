import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureDeviceSession } from './auth.js';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('ensureDeviceSession', () => {
  it('stays silent when offline or auth is undeployed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(ensureDeviceSession()).resolves.toBeUndefined();
  });

  it('does not throw when the server answers without a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => null }),
    );
    await expect(ensureDeviceSession()).resolves.toBeUndefined();
  });
});
