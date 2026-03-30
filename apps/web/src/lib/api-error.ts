import { NextResponse } from 'next/server';

/**
 * Sanitize a Supabase/DB error for client consumption.
 * Strips internal details (table names, column names, schema cache info)
 * to prevent information disclosure.
 */
export function safeErrorMessage(
  error: { message?: string; code?: string },
  fallback: string,
): string {
  const msg = error?.message ?? '';

  // Known patterns that leak internal schema info
  const leakyPatterns = [
    /column .+ does not exist/i,
    /relation ".+" does not exist/i,
    /schema cache/i,
    /Could not find/i,
    /violates .+ constraint/i,
    /duplicate key value/i,
  ];

  if (leakyPatterns.some((p) => p.test(msg))) {
    return fallback;
  }

  return msg || fallback;
}

/** Standard 500 response with sanitized error */
export function serverError(context: string) {
  return NextResponse.json({ error: context }, { status: 500 });
}

// ─── Standardized API Error Responses ──────────────────────────────

/**
 * Return a structured JSON error response.
 *
 * All API routes should use this (or the convenience wrappers below)
 * so clients see a consistent `{ error, message }` shape.
 */
export function apiError(
  status: number,
  error: string,
  message?: string | undefined,
): NextResponse {
  return NextResponse.json({ error, message: message ?? error }, { status });
}

export function badRequest(message: string) {
  return apiError(400, 'bad_request', message);
}

export function notFound(message = 'Resource not found') {
  return apiError(404, 'not_found', message);
}

export function conflict(message: string) {
  return apiError(409, 'conflict', message);
}

/**
 * Build a 500 from a Supabase error, sanitizing internal details.
 */
export function dbError(err: { message?: string; code?: string }, context: string) {
  return apiError(500, 'server_error', safeErrorMessage(err, context));
}

// ─── Safe Body Parser ──────────────────────────────────────────────

/**
 * Parse request JSON body, returning `null` if the body is missing or
 * not valid JSON (instead of throwing).
 */
export async function safeParseBody<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
