import { NextResponse } from 'next/server';
import { proxyServiceRequest } from '@/lib/server/service-proxy';
import { requireRole } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Covers backtest (45s) and strategy scan operations.
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function getCorrelationId(request: Request): string {
  return request.headers.get('x-correlation-id') ?? crypto.randomUUID();
}

const SAFE_READ_PREFIXES = [
  '/health',
  '/ready',
  '/api/v1/data/quotes',
  '/api/v1/data/bars/',
  '/api/v1/portfolio/account',
  '/api/v1/portfolio/positions',
  '/api/v1/portfolio/orders',
  '/api/v1/portfolio/orders/history',
  '/api/v1/strategies',
  '/risk/state',
  '/risk/limits',
  '/risk/policy',
  '/risk/universe-restrictions',
  '/onboarding/status',
  '/strategies',
] as const;

const AUTH_MUTATION_PREFIXES = ['/api/v1/portfolio/orders'] as const;

const OPERATOR_MUTATION_PREFIXES = [
  '/api/v1/strategies/scan',
  '/api/v1/backtest/run',
  '/risk/halt',
  '/risk/resume',
  '/risk/policy',
  '/risk/universe-restrictions',
  '/onboarding/broker-application',
] as const;

function hasAllowedPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const upstreamPath = `/${(path ?? []).join('/')}`;
  const method = request.method.toUpperCase();
  const correlationId = getCorrelationId(request);
  const extraHeaders: Record<string, string> = {
    'x-correlation-id': correlationId,
  };

  // Health/readiness endpoints are public for monitoring
  if (upstreamPath === '/health' || upstreamPath === '/ready') {
    return proxyServiceRequest('engine', request, path, extraHeaders);
  }

  if (method === 'GET' || method === 'HEAD') {
    if (!hasAllowedPrefix(upstreamPath, SAFE_READ_PREFIXES)) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Engine path is not exposed by web proxy.', correlationId },
        { status: 403, headers: { 'x-correlation-id': correlationId } },
      );
    }
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'unauthorized', message: 'Not authenticated', correlationId },
          { status: 401, headers: { 'x-correlation-id': correlationId } },
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          scope: 'engine-proxy',
          level: 'error',
          action: 'auth_failed',
          correlationId,
          message: error instanceof Error ? error.message : 'Unknown auth error',
        }),
      );
      return NextResponse.json(
        { error: 'unauthorized', message: 'Not authenticated', correlationId },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return proxyServiceRequest('engine', request, path, extraHeaders);
  }

  if (hasAllowedPrefix(upstreamPath, OPERATOR_MUTATION_PREFIXES)) {
    const authz = await requireRole('operator');
    if (authz instanceof NextResponse) {
      return NextResponse.json(
        { ...(await authz.json()), correlationId },
        { status: authz.status, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return proxyServiceRequest('engine', request, path, extraHeaders);
  }

  if (hasAllowedPrefix(upstreamPath, AUTH_MUTATION_PREFIXES)) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'unauthorized', message: 'Not authenticated', correlationId },
          { status: 401, headers: { 'x-correlation-id': correlationId } },
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          scope: 'engine-proxy',
          level: 'error',
          action: 'auth_failed',
          correlationId,
          message: error instanceof Error ? error.message : 'Unknown auth error',
        }),
      );
      return NextResponse.json(
        { error: 'unauthorized', message: 'Not authenticated', correlationId },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    return proxyServiceRequest('engine', request, path, extraHeaders);
  }

  return NextResponse.json(
    {
      error: 'forbidden',
      message: 'Mutating engine path is denied by proxy policy.',
      correlationId,
    },
    { status: 403, headers: { 'x-correlation-id': correlationId } },
  );
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
};
