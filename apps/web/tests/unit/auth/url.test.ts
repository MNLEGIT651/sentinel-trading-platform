import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Dynamic import so we can manipulate env vars before each test
async function loadUrlModule() {
  // Clear module cache
  vi.resetModules();
  return import('@/lib/auth/url');
}

describe('getCanonicalUrl', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns NEXT_PUBLIC_SITE_URL when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sentinel.example.com';
    const { getCanonicalUrl } = await loadUrlModule();
    expect(getCanonicalUrl()).toBe('https://sentinel.example.com');
  });

  it('strips trailing slash from NEXT_PUBLIC_SITE_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sentinel.example.com/';
    const { getCanonicalUrl } = await loadUrlModule();
    expect(getCanonicalUrl()).toBe('https://sentinel.example.com');
  });

  it('falls back to NEXT_PUBLIC_VERCEL_URL when SITE_URL is not set', async () => {
    process.env.NEXT_PUBLIC_VERCEL_URL = 'my-app-abc123.vercel.app';
    const { getCanonicalUrl } = await loadUrlModule();
    expect(getCanonicalUrl()).toBe('https://my-app-abc123.vercel.app');
  });

  it('prefers NEXT_PUBLIC_SITE_URL over NEXT_PUBLIC_VERCEL_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://production.example.com';
    process.env.NEXT_PUBLIC_VERCEL_URL = 'preview-abc.vercel.app';
    const { getCanonicalUrl } = await loadUrlModule();
    expect(getCanonicalUrl()).toBe('https://production.example.com');
  });

  it('falls back to localhost when no env vars are set', async () => {
    const { getCanonicalUrl } = await loadUrlModule();
    expect(getCanonicalUrl()).toBe('http://localhost:3000');
  });
});

describe('getEmailRedirectUrl', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
  });

  it('returns canonical URL + /auth/callback by default', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sentinel.example.com';
    const { getEmailRedirectUrl } = await loadUrlModule();
    expect(getEmailRedirectUrl()).toBe('https://sentinel.example.com/auth/callback');
  });

  it('allows custom callback path', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sentinel.example.com';
    const { getEmailRedirectUrl } = await loadUrlModule();
    expect(getEmailRedirectUrl('/auth/confirm')).toBe('https://sentinel.example.com/auth/confirm');
  });
});

describe('getPasswordRecoveryRedirectUrl', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
  });

  it('returns canonical URL + /auth/callback?next=/reset-password', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sentinel.example.com';
    const { getPasswordRecoveryRedirectUrl } = await loadUrlModule();
    expect(getPasswordRecoveryRedirectUrl()).toBe(
      'https://sentinel.example.com/auth/callback?next=/reset-password',
    );
  });
});

describe('sanitizeRedirectPath', () => {
  // sanitizeRedirectPath is a pure function — no env dependency
  let sanitizeRedirectPath: (next: string | null | undefined) => string;

  beforeEach(async () => {
    const mod = await loadUrlModule();
    sanitizeRedirectPath = mod.sanitizeRedirectPath;
  });

  it('returns "/" for null', () => {
    expect(sanitizeRedirectPath(null)).toBe('/');
  });

  it('returns "/" for undefined', () => {
    expect(sanitizeRedirectPath(undefined)).toBe('/');
  });

  it('returns "/" for empty string', () => {
    expect(sanitizeRedirectPath('')).toBe('/');
  });

  it('allows safe relative paths', () => {
    expect(sanitizeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/settings/profile')).toBe('/settings/profile');
    expect(sanitizeRedirectPath('/')).toBe('/');
  });

  it('blocks absolute URLs', () => {
    expect(sanitizeRedirectPath('https://evil.com')).toBe('/');
    expect(sanitizeRedirectPath('http://evil.com/steal')).toBe('/');
  });

  it('blocks protocol-relative URLs', () => {
    expect(sanitizeRedirectPath('//evil.com/path')).toBe('/');
  });

  it('blocks embedded protocol schemes', () => {
    expect(sanitizeRedirectPath('/redirect?url=https://evil.com')).toBe('/');
  });

  it('blocks backslash paths', () => {
    expect(sanitizeRedirectPath('/path\\evil')).toBe('/');
  });

  it('blocks null-byte injection', () => {
    expect(sanitizeRedirectPath('/safe\0evil')).toBe('/');
  });

  it('blocks paths not starting with /', () => {
    expect(sanitizeRedirectPath('dashboard')).toBe('/');
    expect(sanitizeRedirectPath('evil.com/path')).toBe('/');
  });
});

// ---------------------------------------------------------------------------
// getRequestOrigin — request-based origin resolution
// ---------------------------------------------------------------------------

describe('getRequestOrigin', () => {
  it('returns origin from request URL', async () => {
    const { getRequestOrigin } = await loadUrlModule();
    const req = new Request('https://sentinel.example.com/api/data');
    expect(getRequestOrigin(req)).toBe('https://sentinel.example.com');
  });

  it('handles raw Vercel deployment URLs', async () => {
    const { getRequestOrigin } = await loadUrlModule();
    const req = new Request('https://trading-abc123.vercel.app/api/data');
    expect(getRequestOrigin(req)).toBe('https://trading-abc123.vercel.app');
  });

  it('handles localhost with port', async () => {
    const { getRequestOrigin } = await loadUrlModule();
    const req = new Request('http://localhost:3000/api/data');
    expect(getRequestOrigin(req)).toBe('http://localhost:3000');
  });

  it('handles production canonical URL', async () => {
    const { getRequestOrigin } = await loadUrlModule();
    const req = new Request('https://sentinel-trading-platform.vercel.app/signals');
    expect(getRequestOrigin(req)).toBe('https://sentinel-trading-platform.vercel.app');
  });
});

// ---------------------------------------------------------------------------
// getCanonicalHost — hostname extraction from NEXT_PUBLIC_SITE_URL
// ---------------------------------------------------------------------------

describe('getCanonicalHost', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
  });

  it('returns hostname from NEXT_PUBLIC_SITE_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sentinel-trading-platform.vercel.app';
    const { getCanonicalHost } = await loadUrlModule();
    expect(getCanonicalHost()).toBe('sentinel-trading-platform.vercel.app');
  });

  it('returns null when NEXT_PUBLIC_SITE_URL is not set', async () => {
    const { getCanonicalHost } = await loadUrlModule();
    expect(getCanonicalHost()).toBeNull();
  });

  it('handles URL without protocol prefix', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'sentinel-trading-platform.vercel.app';
    const { getCanonicalHost } = await loadUrlModule();
    expect(getCanonicalHost()).toBe('sentinel-trading-platform.vercel.app');
  });

  it('strips trailing slash before parsing', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sentinel-trading-platform.vercel.app/';
    const { getCanonicalHost } = await loadUrlModule();
    expect(getCanonicalHost()).toBe('sentinel-trading-platform.vercel.app');
  });
});

// ---------------------------------------------------------------------------
// getCanonicalSiteUrl — alias for getCanonicalUrl
// ---------------------------------------------------------------------------

describe('getCanonicalSiteUrl', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
  });

  it('is an alias that returns the same value as getCanonicalUrl', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sentinel.example.com';
    const { getCanonicalUrl, getCanonicalSiteUrl } = await loadUrlModule();
    expect(getCanonicalSiteUrl()).toBe(getCanonicalUrl());
  });
});
