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

  // Return degraded status when any configured service is unreachable
  const hasDegraded = engine === 'disconnected' || agents === 'disconnected';

  const status = hasDegraded ? 'degraded' : 'ok';

  // Always return 200 — this service is healthy even when dependencies are not.
  // Load balancers should keep this node in rotation; the `status` field
  // communicates dependency health to monitoring systems.
  return NextResponse.json({
    status,
    service: 'sentinel-web',
    timestamp: new Date().toISOString(),
    dependencies: {
      engine,
      agents,
    },
  });
}
