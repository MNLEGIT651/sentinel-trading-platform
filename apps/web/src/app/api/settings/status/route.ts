import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getServiceConfig } from '@/lib/server/service-config';

export const maxDuration = 10;

type ServiceStatus = 'connected' | 'disconnected' | 'not_configured';

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
  if (configured === true) return 'connected';
  if (configured === false) return 'not_configured';
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
    if (!response.ok) throw new Error(`${response.status}`);
    return { status: 'connected', data: (await response.json()) as T };
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
