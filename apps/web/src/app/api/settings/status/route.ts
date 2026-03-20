import { NextResponse } from 'next/server';
import { getServiceConfig } from '@/lib/server/service-config';

type ServiceStatus = 'connected' | 'disconnected' | 'not_configured';

interface StatusResponse {
  engine: ServiceStatus;
  agents: ServiceStatus;
  polygon: ServiceStatus;
  supabase: ServiceStatus;
  anthropic: ServiceStatus;
  alpaca: ServiceStatus;
}

async function probe(
  fn: (signal: AbortSignal) => Promise<void>,
  timeoutMs = 4_000,
): Promise<'connected' | 'disconnected'> {
  try {
    await fn(AbortSignal.timeout(timeoutMs));
    return 'connected';
  } catch {
    return 'disconnected';
  }
}

export async function GET(): Promise<NextResponse<StatusResponse>> {
  // ── Engine ──────────────────────────────────────────────────────────
  const engineConfig = getServiceConfig('engine');
  const engine: ServiceStatus =
    !engineConfig.configured || !engineConfig.baseUrl
      ? 'not_configured'
      : await probe(async (signal) => {
          const r = await fetch(`${engineConfig.baseUrl}/health`, {
            headers: engineConfig.headers,
            signal,
            cache: 'no-store',
          });
          if (!r.ok) throw new Error(`${r.status}`);
        });

  // ── Agents ──────────────────────────────────────────────────────────
  const agentsConfig = getServiceConfig('agents');
  const agents: ServiceStatus =
    !agentsConfig.configured || !agentsConfig.baseUrl
      ? 'not_configured'
      : await probe(async (signal) => {
          const r = await fetch(`${agentsConfig.baseUrl}/health`, {
            headers: agentsConfig.headers,
            signal,
            cache: 'no-store',
          });
          if (!r.ok) throw new Error(`${r.status}`);
        });

  // ── Polygon ─────────────────────────────────────────────────────────
  const polygonKey = process.env.POLYGON_API_KEY;
  let polygon: ServiceStatus;
  if (engine === 'connected' && engineConfig.baseUrl) {
    polygon = await probe(async (signal) => {
      const r = await fetch(`${engineConfig.baseUrl}/api/v1/data/quotes?tickers=AAPL`, {
        headers: engineConfig.headers,
        signal,
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`${r.status}`);
    }, 8_000);
  } else if (!polygonKey) {
    polygon = 'not_configured';
  } else {
    polygon = await probe(async (signal) => {
      const r = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=${polygonKey}`,
        { signal, cache: 'no-store' },
      );
      if (!r.ok) throw new Error(`${r.status}`);
    });
  }

  // ── Supabase ─────────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase: ServiceStatus =
    !supabaseUrl || !supabaseKey
      ? 'not_configured'
      : await probe(async (signal) => {
          const r = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
            signal,
            cache: 'no-store',
          });
          if (!r.ok) throw new Error(`${r.status}`);
        });

  // ── Anthropic ────────────────────────────────────────────────────────
  // Check directly if key is available, otherwise try agents health endpoint.
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  let anthropic: ServiceStatus;
  if (anthropicKey) {
    anthropic = await probe(async (signal) => {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        signal,
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`${r.status}`);
    });
  } else if (agentsConfig.baseUrl) {
    anthropic =
      agents === 'not_configured'
        ? 'not_configured'
        : await probe(async (signal) => {
            const r = await fetch(`${agentsConfig.baseUrl}/health`, { signal, cache: 'no-store' });
            if (!r.ok) throw new Error(`${r.status}`);
          });
  } else {
    anthropic = 'not_configured';
  }

  // ── Alpaca ───────────────────────────────────────────────────────────
  // Check directly if keys are available, otherwise probe through the engine
  // (the engine already holds broker credentials).
  const alpacaKey = process.env.ALPACA_API_KEY;
  const alpacaSecret = process.env.ALPACA_SECRET_KEY;
  let alpaca: ServiceStatus;
  if (alpacaKey && alpacaSecret) {
    const alpacaBase = process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets/v2';
    alpaca = await probe(async (signal) => {
      const r = await fetch(`${alpacaBase}/account`, {
        headers: {
          'APCA-API-KEY-ID': alpacaKey,
          'APCA-API-SECRET-KEY': alpacaSecret,
        },
        signal,
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`${r.status}`);
    });
  } else if (engine === 'connected' && engineConfig.baseUrl) {
    // Proxy through engine — it already has broker credentials
    alpaca = await probe(async (signal) => {
      const r = await fetch(`${engineConfig.baseUrl}/api/v1/portfolio/account`, {
        headers: engineConfig.headers,
        signal,
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`${r.status}`);
    });
  } else {
    alpaca = 'not_configured';
  }

  return NextResponse.json({ engine, agents, polygon, supabase, anthropic, alpaca });
}
