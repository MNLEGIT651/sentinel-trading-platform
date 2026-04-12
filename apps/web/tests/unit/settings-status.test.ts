import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = { id: 'test-user', email: 'test@example.com' };
const mockSupabase = {};

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ user: mockUser, supabase: mockSupabase })),
  requireRole: vi.fn(async () => ({ user: mockUser, supabase: mockSupabase })),
}));

import { GET } from '@/app/api/settings/status/route';

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  ENGINE_URL: process.env.ENGINE_URL,
  ENGINE_API_KEY: process.env.ENGINE_API_KEY,
  AGENTS_URL: process.env.AGENTS_URL,
  POLYGON_API_KEY: process.env.POLYGON_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ALPACA_API_KEY: process.env.ALPACA_API_KEY,
  ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY,
  ALPACA_BASE_URL: process.env.ALPACA_BASE_URL,
};

function restoreEnv() {
  (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv.NODE_ENV;
  process.env.ENGINE_URL = originalEnv.ENGINE_URL;
  process.env.ENGINE_API_KEY = originalEnv.ENGINE_API_KEY;
  process.env.AGENTS_URL = originalEnv.AGENTS_URL;
  process.env.POLYGON_API_KEY = originalEnv.POLYGON_API_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
  process.env.ALPACA_API_KEY = originalEnv.ALPACA_API_KEY;
  process.env.ALPACA_SECRET_KEY = originalEnv.ALPACA_SECRET_KEY;
  process.env.ALPACA_BASE_URL = originalEnv.ALPACA_BASE_URL;
}

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe('/api/settings/status', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('marks localhost engine targets and missing agents service as not configured in production', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'http://localhost:8000';
    process.env.ENGINE_API_KEY = 'secret-key';
    delete process.env.AGENTS_URL;
    delete process.env.POLYGON_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    delete process.env.ALPACA_BASE_URL;

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      engine: 'not_configured',
      agents: 'not_configured',
      polygon: 'not_configured',
      supabase: 'not_configured',
      anthropic: 'not_configured',
      alpaca: 'not_configured',
    });
  });

  it('derives provider readiness from engine and agents health payloads', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'secret-key';
    process.env.AGENTS_URL = 'https://agents.example';
    delete process.env.POLYGON_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    delete process.env.ALPACA_BASE_URL;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://engine.example/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'sentinel-engine',
            dependencies: { polygon: true, alpaca: true, supabase: true },
          }),
          { status: 200 },
        );
      }

      if (url === 'https://agents.example/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            dependencies: { engine: true, anthropic: true, supabase: true },
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      engine: 'connected',
      agents: 'connected',
      polygon: 'connected',
      supabase: 'connected',
      anthropic: 'connected',
      alpaca: 'connected',
    });
  });

  it('keeps provider status disconnected when health checks fail behind healthy services', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'secret-key';
    process.env.AGENTS_URL = 'https://agents.example';
    process.env.SUPABASE_URL = 'https://supabase.example';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase-secret';
    process.env.ANTHROPIC_API_KEY = 'anthropic-secret';
    delete process.env.POLYGON_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    delete process.env.ALPACA_BASE_URL;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://engine.example/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            dependencies: { polygon: false, alpaca: false, supabase: true },
          }),
          { status: 200 },
        );
      }

      if (url === 'https://agents.example/health') {
        return new Response(
          JSON.stringify({ status: 'ok', dependencies: { anthropic: false, supabase: true } }),
          { status: 200 },
        );
      }

      if (url === 'https://engine.example/api/v1/data/quotes?tickers=AAPL') {
        return new Response(JSON.stringify({ detail: 'polygon unavailable' }), { status: 503 });
      }

      if (url === 'https://supabase.example/rest/v1/') {
        return new Response('{}', { status: 200 });
      }

      if (url === 'https://api.anthropic.com/v1/models') {
        return new Response(JSON.stringify({ error: 'anthropic unavailable' }), { status: 503 });
      }

      if (url === 'https://engine.example/api/v1/portfolio/account') {
        return new Response(JSON.stringify({ detail: 'alpaca unavailable' }), { status: 503 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      engine: 'connected',
      agents: 'connected',
      polygon: 'not_configured',
      supabase: 'connected',
      anthropic: 'not_configured',
      alpaca: 'not_configured',
    });
  });

  it('reports engine as degraded when health returns 200 with degraded status', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'secret-key';
    process.env.AGENTS_URL = 'https://agents.example';
    delete process.env.POLYGON_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    delete process.env.ALPACA_BASE_URL;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://engine.example/health') {
        return new Response(
          JSON.stringify({
            status: 'degraded',
            service: 'sentinel-engine',
            dependencies: { polygon: true, alpaca: true, supabase: false },
          }),
          { status: 200 },
        );
      }
      if (url === 'https://agents.example/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            dependencies: { engine: true, anthropic: true, supabase: true },
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      engine: 'degraded',
      agents: 'connected',
      supabase: 'disconnected',
    });
  });

  it('reports engine as degraded when health returns 503 with degraded body (defense-in-depth)', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'secret-key';
    delete process.env.AGENTS_URL;
    delete process.env.POLYGON_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    delete process.env.ALPACA_BASE_URL;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://engine.example/health') {
        return new Response(
          JSON.stringify({
            status: 'degraded',
            service: 'sentinel-engine',
            dependencies: { polygon: true, alpaca: true, supabase: false },
          }),
          { status: 503 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      engine: 'degraded',
      agents: 'not_configured',
    });
  });

  it('reports engine as disconnected when health returns non-degraded error', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'secret-key';
    delete process.env.AGENTS_URL;
    delete process.env.POLYGON_API_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    delete process.env.ALPACA_BASE_URL;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://engine.example/health') {
        return new Response(JSON.stringify({ error: 'internal server error' }), { status: 500 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      engine: 'disconnected',
      agents: 'not_configured',
    });
  });
});
