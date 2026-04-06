import { NextResponse } from 'next/server';
import { proxyServiceRequest } from '@/lib/server/service-proxy';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Max agent timeout is 8s — 15s gives comfortable headroom.
export const maxDuration = 15;

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

/**
 * Extract the user's Supabase access token from cookies.
 * Returns the token string or null if not authenticated.
 *
 * Uses getUser() instead of getSession() to cryptographically validate
 * the JWT before forwarding it to the agents service.
 */
async function getUserToken(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    // Validate the JWT first — getSession() does NOT verify the token.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    // Only after validation, read the session to get the access token.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: 'agents-proxy',
        level: 'error',
        action: 'token_extraction_failed',
        message: error instanceof Error ? error.message : 'Unknown auth error',
      }),
    );
    return null;
  }
}

function getCorrelationId(request: Request): string {
  return request.headers.get('x-correlation-id') ?? crypto.randomUUID();
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const upstreamPath = `/${(path ?? []).join('/')}`;

  // Health and status are public — no auth needed
  const isPublic = upstreamPath === '/health' || upstreamPath === '/status';

  const correlationId = getCorrelationId(request);
  const extraHeaders: Record<string, string> = {
    'x-correlation-id': correlationId,
  };

  if (!isPublic) {
    const token = await getUserToken();
    if (!token) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Not authenticated', correlationId },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    extraHeaders['Authorization'] = `Bearer ${token}`;
  }

  return proxyServiceRequest('agents', request, path, extraHeaders);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
};
