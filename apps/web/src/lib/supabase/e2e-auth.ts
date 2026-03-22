export const E2E_AUTH_BYPASS_COOKIE = 'sentinel-e2e-auth';
export const E2E_AUTH_BYPASS_ACCESS_TOKEN = 'sentinel-e2e-access-token';
export const E2E_AUTH_BYPASS_USER = {
  id: 'sentinel-e2e-user',
  email: 'e2e@sentinel.local',
  aud: 'authenticated',
  role: 'authenticated',
} as const;

type EnvLike = Record<string, string | undefined>;
type ReadCookie = (name: string) => string | undefined;

export function isE2EAuthBypassEnabled(env: EnvLike = process.env): boolean {
  return env.E2E_AUTH_BYPASS === '1' && env.NODE_ENV !== 'production';
}

export function getE2EAuthBypassState(
  readCookie: ReadCookie,
  env: EnvLike = process.env,
): {
  enabled: boolean;
  user: typeof E2E_AUTH_BYPASS_USER | null;
  session: {
    access_token: string;
    user: typeof E2E_AUTH_BYPASS_USER;
  } | null;
} {
  const enabled = isE2EAuthBypassEnabled(env) && readCookie(E2E_AUTH_BYPASS_COOKIE) === '1';

  if (!enabled) {
    return { enabled: false, user: null, session: null };
  }

  return {
    enabled: true,
    user: E2E_AUTH_BYPASS_USER,
    session: {
      access_token: E2E_AUTH_BYPASS_ACCESS_TOKEN,
      user: E2E_AUTH_BYPASS_USER,
    },
  };
}
