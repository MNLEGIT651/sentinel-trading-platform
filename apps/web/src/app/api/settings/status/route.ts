import { NextResponse } from 'next/server';

type ServiceStatus = 'connected' | 'disconnected' | 'not_configured';

interface StatusResponse {
  engine: ServiceStatus;
  polygon: ServiceStatus;
  supabase: ServiceStatus;
  anthropic: ServiceStatus;
  alpaca: ServiceStatus;
}

async function probe(fn: () => Promise<void>): Promise<'connected' | 'disconnected'> {
  try {
    await fn();
    return 'connected';
  } catch {
    return 'disconnected';
  }
}

export async function GET(): Promise<NextResponse<StatusResponse>> {
  const signal = AbortSignal.timeout(4000);

  // ── Engine ──────────────────────────────────────────────────────────
  const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8000';
  const engineKey = process.env.ENGINE_API_KEY ?? 'sentinel-dev-key';
  const engine = await probe(async () => {
    const r = await fetch(`${engineUrl}/health`, {
      headers: { Authorization: `Bearer ${engineKey}` },
      signal,
      cache: 'no-store',
    });
    if (!r.ok) throw new Error(`${r.status}`);
  });

  // ── Polygon ─────────────────────────────────────────────────────────
  const polygonKey = process.env.POLYGON_API_KEY;
  const polygon: ServiceStatus = !polygonKey
    ? 'not_configured'
    : await probe(async () => {
        const r = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=${polygonKey}`,
          { signal, cache: 'no-store' },
        );
        if (!r.ok) throw new Error(`${r.status}`);
      });

  // ── Supabase ─────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase: ServiceStatus =
    !supabaseUrl || !supabaseKey
      ? 'not_configured'
      : await probe(async () => {
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
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropic: ServiceStatus = !anthropicKey
    ? 'not_configured'
    : await probe(async () => {
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

  // ── Alpaca ───────────────────────────────────────────────────────────
  const alpacaKey = process.env.ALPACA_API_KEY;
  const alpacaSecret = process.env.ALPACA_SECRET_KEY;
  const alpacaBase = process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets/v2';
  const alpaca: ServiceStatus =
    !alpacaKey || !alpacaSecret
      ? 'not_configured'
      : await probe(async () => {
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

  return NextResponse.json({ engine, polygon, supabase, anthropic, alpaca });
}
