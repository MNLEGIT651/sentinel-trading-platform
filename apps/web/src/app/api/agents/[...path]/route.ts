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

const PUBLIC_PATHS = new Set(['/health', '/status']);
const SAFE_READ_PREFIXES = ['/recommendations', '/alerts', '/agent-runs'] as const;
const AUTH_MUTATION_PREFIXES = ['/recommendations/'] as const;
const OPERATOR_MUTATION_PATHS = new Set(['/cycle', '/halt', '/resume', '/research/ticker']);

function hasAllowedPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const upstreamPath = `/${(path ?? []).join('/')}`;
  const method = request.method.toUpperCase();

  const correlationId = getCorrelationId(request);
  const extraHeaders: Record<string, string> = {
    'x-correlation-id': correlationId,
  };

  if (PUBLIC_PATHS.has(upstreamPath)) {
    return proxyServiceRequest('agents', request, path, extraHeaders);
  }

  const isSafeRead =
    method === 'GET' || method === 'HEAD'
      ? hasAllowedPrefix(upstreamPath, SAFE_READ_PREFIXES)
      : false;
  const isAuthMutation = method !== 'GET' && method !== 'HEAD' && hasAllowedPrefix(upstreamPath, AUTH_MUTATION_PREFIXES);
  const isOperatorMutation = method !== 'GET' && method !== 'HEAD' && OPERATOR_MUTATION_PATHS.has(upstreamPath);

  if (!(isSafeRead || isAuthMutation || isOperatorMutation)) {
    return NextResponse.json(
      {
        error: 'forbidden',
        message: 'Agents path is denied by proxy policy.',
        correlationId,
      },
      { status: 403, headers: { 'x-correlation-id': correlationId } },
    );
  }

  if (isOperatorMutation) {
    const supabase = await createServerSupabaseClient();
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role')
      .single();
    if (error || profile?.role !== 'operator') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Operator role required.', correlationId },
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
  }

  {
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
