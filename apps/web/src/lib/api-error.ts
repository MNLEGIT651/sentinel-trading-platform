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
