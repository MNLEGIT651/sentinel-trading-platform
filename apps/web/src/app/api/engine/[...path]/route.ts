import { NextResponse } from 'next/server';
import { proxyServiceRequest } from '@/lib/server/service-proxy';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const upstreamPath = `/${(path ?? []).join('/')}`;

  // Health endpoint is public for monitoring
  if (upstreamPath === '/health') {
    return proxyServiceRequest('engine', request, path);
  }

  // All other engine endpoints require an authenticated user
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Not authenticated' },
        { status: 401 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Not authenticated' },
      { status: 401 },
    );
  }

  return proxyServiceRequest('engine', request, path);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
};
