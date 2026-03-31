/**
 * Zod-based request validation helpers for Next.js API routes.
 *
 * Usage:
 * ```ts
 * const Schema = z.object({ name: z.string().min(1) });
 *
 * export async function POST(req: Request) {
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *
 *   const body = await parseBody(req, Schema);
 *   if (body instanceof NextResponse) return body;
 *
 *   // body is typed as { name: string }
 * }
 * ```
 */
import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the parsed data on success, or a 400 NextResponse on failure.
 */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'bad_request', message: 'Invalid or missing JSON body' },
      { status: 400 },
    );
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return NextResponse.json(
      { error: 'validation_error', message: issues[0]?.message ?? 'Invalid input', issues },
      { status: 400 },
    );
  }

  return result.data;
}

/**
 * Parse and validate URL search params against a Zod schema.
 * Returns the parsed data on success, or a 400 NextResponse on failure.
 *
 * Use `z.coerce.number()` for numeric params since search params are strings.
 */
export function parseSearchParams<T>(req: Request, schema: ZodType<T>): T | NextResponse {
  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return NextResponse.json(
      { error: 'validation_error', message: issues[0]?.message ?? 'Invalid query params', issues },
      { status: 400 },
    );
  }

  return result.data;
}

// ─── Shared Schemas ────────────────────────────────────────────────

/** UUID path parameter */
export const uuidParam = z.string().uuid('Invalid UUID format');

/** Common pagination query params */
export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** Sort direction */
export const sortDirection = z.enum(['asc', 'desc']).optional().default('desc');
