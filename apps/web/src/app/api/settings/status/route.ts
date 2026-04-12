import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getServiceConfig } from '@/lib/server/service-config';

export const maxDuration = 10;

type ServiceStatus = 'connected' | 'degraded' | 'disconnected' | 'not_configured';

interface StatusResponse {
  engine: ServiceStatus;
  agents: ServiceStatus;
  polygon: ServiceStatus;
  supabase: ServiceStatus;
  anthropic: ServiceStatus;
  alpaca: ServiceStatus;
}

interface EngineHealthResponse {
  dependencies?: {
    polygon?: boolean;
    alpaca?: boolean;
    supabase?: boolean;
  };
}

interface AgentsHealthResponse {
  dependencies?: {
    engine?: boolean;
    anthropic?: boolean;
    supabase?: boolean;
  };
}

function dependencyStatus(ownerStatus: ServiceStatus, configured?: boolean): ServiceStatus {
  if (ownerStatus === 'not_configured') return 'not_configured';
  if (ownerStatus === 'disconnected') return 'disconnected';
  // Owner is connected or degraded — dependency state depends on its own health
  if (configured === true) return 'connected';
  if (configured === false) {
    // When owner is degraded, false means the dependency is configured but
    // unreachable (e.g., Supabase configured on engine but probe failed).
    return ownerStatus === 'degraded' ? 'disconnected' : 'not_configured';
  }
  return 'disconnected';
}

async function fetchConfiguredServiceJson<T>(
  config: ReturnType<typeof getServiceConfig>,
  path = '/health',
  timeoutMs = 4_000,
): Promise<{ status: ServiceStatus; data: T | null }> {
  if (!config.configured || !config.baseUrl) {
    return { status: 'not_configured', data: null };
  }

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      headers: config.headers,
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });

    // Any parseable response means the service process is alive.
    // Parse the body even from non-200 so we capture dependency info.
    let data: T | null = null;
    try {
      data = (await response.json()) as T;
    } catch {
      // Body wasn't valid JSON — service may be misconfigured or broken
      if (!response.ok) return { status: 'disconnected', data: null };
    }

    if (!response.ok) {
      // Only classify as degraded if body matches health contract
      const bodyStatus = (data as Record<string, unknown> | null)?.status;
      if (bodyStatus === 'degraded') {
        return { status: 'degraded', data };
      }
      // Non-200 with unexpected body (auth error, crash) is truly disconnected
      return { status: 'disconnected', data: null };
    }

    // Check if the service self-reports as degraded even on 200
    const bodyStatus = (data as Record<string, unknown> | null)?.status;
    if (bodyStatus === 'degraded') {
      return { status: 'degraded', data };
    }

    return { status: 'connected', data };
  } catch (error) {
    console.error('settings.status.GET', error);
    return { status: 'disconnected', data: null };
  }
}

export async function GET(): Promise<NextResponse<StatusResponse>> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth as NextResponse<StatusResponse>;

  const engineConfig = getServiceConfig('engine');
  const agentsConfig = getServiceConfig('agents');

  const [engineResult, agentsResult] = await Promise.all([
    fetchConfiguredServiceJson<EngineHealthResponse>(engineConfig),
    fetchConfiguredServiceJson<AgentsHealthResponse>(agentsConfig),
  ]);
  const engine = engineResult.status;
  const agents = agentsResult.status;
  const engineDependencies = engineResult.data?.dependencies;
  const agentsDependencies = agentsResult.data?.dependencies;

  const polygon = dependencyStatus(engine, engineDependencies?.polygon);
  const supabase = dependencyStatus(engine, engineDependencies?.supabase);
  const anthropic = dependencyStatus(agents, agentsDependencies?.anthropic);
  const alpaca = dependencyStatus(engine, engineDependencies?.alpaca);

  return NextResponse.json({ engine, agents, polygon, supabase, anthropic, alpaca });
}
