/**
 * JWT authentication middleware for the Sentinel Agent HTTP server.
 *
 * Validates the `Authorization: Bearer <token>` header forwarded by the
 * Next.js API proxy. The token is a Supabase access token — we verify its
 * signature using the project's JWT secret (HS256).
 *
 * Public routes (/health, /status) bypass this middleware entirely; the
 * proxy skips token injection for those paths.
 */

import type { Request, Response, NextFunction } from 'express';
import { jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? '';

/**
 * Express middleware that enforces bearer-token authentication.
 * Rejects with 401 when the token is absent, expired, or invalid.
 *
 * Fails closed: if SUPABASE_JWT_SECRET is not configured, every request
 * is rejected rather than silently accepted with an empty-string key.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Fail closed — never accept tokens when the secret is unconfigured.
  if (!JWT_SECRET) {
    res.status(503).json({
      error: 'misconfigured',
      message: 'Auth service is not configured. Set SUPABASE_JWT_SECRET.',
    });
    return;
  }

  // req.get() always returns string | undefined, never string[]
  const authHeader = req.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing bearer token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify<JWTPayload>(token, secret, { algorithms: ['HS256'] });

    // Attach the decoded payload to the request for downstream handlers.
    req.user = payload;

    next();
  } catch {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
  }
}
