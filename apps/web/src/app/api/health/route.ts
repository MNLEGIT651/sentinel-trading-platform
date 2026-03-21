import { NextResponse } from 'next/server';
import { getServiceConfig } from '@/lib/server/service-config';
import type { ServiceName } from '@/lib/service-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DependencyStatus = 'connected' | 'disconnected' | 'not_configured';

async function checkDependency(service: ServiceName): Promise<DependencyStatus> {
  const config = getServiceConfig(service);

  if (!config.configured || !config.baseUrl) {
    return 'not_configured';
  }

  try {
    const response = await fetch(new URL('/health', `${config.baseUrl}/`).toString(), {
      headers: config.headers,
      signal: AbortSignal.timeout(4_000),
      cache: 'no-store',
    });

    return response.ok ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  }
}

export async function GET() {
  const [engine, agents] = await Promise.all([
    checkDependency('engine'),
    checkDependency('agents'),
  ]);

  return NextResponse.json({
    status: 'ok',
    service: 'sentinel-web',
    timestamp: new Date().toISOString(),
    dependencies: {
      engine,
      agents,
    },
  });
}
