import { NextResponse } from 'next/server';
import { proxyServiceRequest } from '@/lib/server/service-proxy';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function getCorrelationId(request: Request): string {
  return request.headers.get('x-correlation-id') ?? crypto.randomUUID();
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const upstreamPath = `/${(path ?? []).join('/')}`;
  const correlationId = getCorrelationId(request);
  const extraHeaders: Record<string, string> = {
    'x-correlation-id': correlationId,
  };

  // Health endpoint is public for monitoring
  if (upstreamPath === '/health') {
    return proxyServiceRequest('engine', request, path, extraHeaders);
  }

  // All other engine endpoints require an authenticated user
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

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
};
