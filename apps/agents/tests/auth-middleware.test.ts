/**
 * Unit tests for auth-middleware.ts
 *
 * Covers: missing secret (fail-closed), missing header, invalid token, valid token.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMocks() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;
  return { res, next };
}

function makeReq(authHeader?: string): Request {
  const headers: Record<string, string> = authHeader ? { authorization: authHeader } : {};
  return {
    headers,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

async function signToken(secret: string, payload: object = { sub: 'user-1' }): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('authMiddleware — misconfigured (empty secret)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns 503 when SUPABASE_JWT_SECRET is not set', async () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', '');
    const { authMiddleware } = await import('../src/auth-middleware.js');

    const { res, next } = makeMocks();
    const req = makeReq('Bearer some.token.here');

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'misconfigured' }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authMiddleware — missing / malformed header', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns 401 when Authorization header is absent', async () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', 'test-secret');
    const { authMiddleware } = await import('../src/auth-middleware.js');

    const { res, next } = makeMocks();
    await authMiddleware(makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'unauthorized',
        message: expect.stringMatching(/missing/i),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', async () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', 'test-secret');
    const { authMiddleware } = await import('../src/auth-middleware.js');

    const { res, next } = makeMocks();
    await authMiddleware(makeReq('Basic dXNlcjpwYXNz'), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authMiddleware — invalid token', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', 'correct-secret');
    const { authMiddleware } = await import('../src/auth-middleware.js');

    const badToken = await signToken('wrong-secret');
    const { res, next } = makeMocks();
    await authMiddleware(makeReq(`Bearer ${badToken}`), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'unauthorized' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a completely malformed token string', async () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', 'correct-secret');
    const { authMiddleware } = await import('../src/auth-middleware.js');

    const { res, next } = makeMocks();
    await authMiddleware(makeReq('Bearer not.a.jwt'), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authMiddleware — valid token', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('calls next() and attaches user payload for a valid token', async () => {
    const secret = 'my-test-jwt-secret';
    vi.stubEnv('SUPABASE_JWT_SECRET', secret);
    const { authMiddleware } = await import('../src/auth-middleware.js');

    const token = await signToken(secret, { sub: 'user-42', email: 'test@example.com' });
    const req = makeReq(`Bearer ${token}`) as Request & { user?: object };
    const { res, next } = makeMocks();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect((req.user as { sub: string }).sub).toBe('user-42');
  });
});
