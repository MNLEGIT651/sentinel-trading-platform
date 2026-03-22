import { describe, expect, it } from 'vitest';
import {
  E2E_AUTH_BYPASS_ACCESS_TOKEN,
  E2E_AUTH_BYPASS_COOKIE,
  E2E_AUTH_BYPASS_USER,
  getE2EAuthBypassState,
  isE2EAuthBypassEnabled,
} from '@/lib/supabase/e2e-auth';

describe('e2e auth bypass helpers', () => {
  it('enables the bypass only for non-production test envs', () => {
    expect(isE2EAuthBypassEnabled({ E2E_AUTH_BYPASS: '1', NODE_ENV: 'development' })).toBe(true);
    expect(isE2EAuthBypassEnabled({ E2E_AUTH_BYPASS: '1', NODE_ENV: 'production' })).toBe(false);
    expect(isE2EAuthBypassEnabled({ E2E_AUTH_BYPASS: undefined, NODE_ENV: 'development' })).toBe(
      false,
    );
  });

  it('returns a synthetic user/session only when the bypass cookie is present', () => {
    const state = getE2EAuthBypassState(
      (name) => (name === E2E_AUTH_BYPASS_COOKIE ? '1' : undefined),
      { E2E_AUTH_BYPASS: '1', NODE_ENV: 'development' },
    );

    expect(state.enabled).toBe(true);
    expect(state.user).toEqual(E2E_AUTH_BYPASS_USER);
    expect(state.session?.access_token).toBe(E2E_AUTH_BYPASS_ACCESS_TOKEN);
  });

  it('stays disabled when the cookie is absent', () => {
    const state = getE2EAuthBypassState(() => undefined, {
      E2E_AUTH_BYPASS: '1',
      NODE_ENV: 'development',
    });

    expect(state).toEqual({ enabled: false, user: null, session: null });
  });
});
