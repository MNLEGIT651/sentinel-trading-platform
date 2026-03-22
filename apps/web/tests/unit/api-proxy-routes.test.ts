/**
 * Unit tests for the API proxy route handlers.
 *
 * /api/engine/[...path] — thin pass-through to proxyServiceRequest('engine', ...)
 * /api/agents/[...path] — adds Supabase session auth before proxying to agents
 *
 * Both handlers are tested in isolation with mocked dependencies so no
 * real network calls or Supabase connections are required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock service-proxy ────────────────────────────────────────────────────

const mockProxyServiceRequest = vi.fn<
  [string, Request, string[] | undefined, Record<string, string>?],
  Promise<Response>
>();

vi.mock('@/lib/server/service-proxy', () => ({
  proxyServiceRequest: (...args: Parameters<typeof mockProxyServiceRequest>) =>
    mockProxyServiceRequest(...args),
}));

// ─── Mock Supabase server client ───────────────────────────────────────────

const mockGetSession = vi.fn<[], Promise<{ data: { session: { access_token: string } | null } }>>();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(url = 'https://sentinel.example/api/engine/health'): Request {
  return new Request(url, { method: 'GET' });
}

function okResponse(body: Record<string, unknown> = { status: 'ok' }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── /api/engine/[...path] ────────────────────────────────────────────────

describe('/api/engine/[...path] route handler', () => {
  // Dynamic import so the vi.mock calls above are applied before the module loads
  let GET: (req: Request, ctx: { params: Promise<{ path?: string[] }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/engine/[...path]/route');
    GET = mod.GET;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('delegates to proxyServiceRequest with service="engine"', async () => {
    const upstream = okResponse();
    mockProxyServiceRequest.mockResolvedValueOnce(upstream);

    const request = makeRequest('https://sentinel.example/api/engine/health');
    const ctx = { params: Promise.resolve({ path: ['health'] }) };

    const response = await GET(request, ctx);

    expect(mockProxyServiceRequest).toHaveBeenCalledOnce();
    expect(mockProxyServiceRequest).toHaveBeenCalledWith('engine', request, ['health']);
    expect(response).toBe(upstream);
  });

  it('passes undefined path when the catch-all is empty', async () => {
    const upstream = okResponse();
    mockProxyServiceRequest.mockResolvedValueOnce(upstream);

    const request = makeRequest();
    const ctx = { params: Promise.resolve({}) };

    await GET(request, ctx);

    expect(mockProxyServiceRequest).toHaveBeenCalledWith('engine', request, undefined);
  });

  it('returns whatever proxyServiceRequest returns (502 on upstream failure)', async () => {
    const errorResponse = new Response(JSON.stringify({ code: 'upstream', service: 'engine' }), {
      status: 502,
    });
    mockProxyServiceRequest.mockResolvedValueOnce(errorResponse);

    const response = await GET(makeRequest(), { params: Promise.resolve({ path: ['health'] }) });

    expect(response.status).toBe(502);
  });
});

// ─── /api/agents/[...path] ────────────────────────────────────────────────

describe('/api/agents/[...path] route handler', () => {
  let handle: (req: Request, ctx: { params: Promise<{ path?: string[] }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/agents/[...path]/route');
    // The handler is exported with all methods aliased to `handle`
    handle = mod.GET;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('proxies /health without requiring auth', async () => {
    const upstream = okResponse({ status: 'ok', agents: 'online' });
    mockProxyServiceRequest.mockResolvedValueOnce(upstream);

    const request = new Request('https://sentinel.example/api/agents/health');
    const ctx = { params: Promise.resolve({ path: ['health'] }) };

    const response = await handle(request, ctx);

    // Should not call getSession for public paths
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockProxyServiceRequest).toHaveBeenCalledWith(
      'agents',
      request,
      ['health'],
      {},
    );
    expect(response).toBe(upstream);
  });

  it('proxies /status without requiring auth', async () => {
    const upstream = okResponse({ status: 'running' });
    mockProxyServiceRequest.mockResolvedValueOnce(upstream);

    const request = new Request('https://sentinel.example/api/agents/status');
    const ctx = { params: Promise.resolve({ path: ['status'] }) };

    await handle(request, ctx);

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockProxyServiceRequest).toHaveBeenCalledWith('agents', request, ['status'], {});
  });

  it('returns 401 when no Supabase session exists for a protected path', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const request = new Request('https://sentinel.example/api/agents/cycles');
    const ctx = { params: Promise.resolve({ path: ['cycles'] }) };

    const response = await handle(request, ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'unauthorized' });
    // Proxy must not be called when auth fails
    expect(mockProxyServiceRequest).not.toHaveBeenCalled();
  });

  it('injects Authorization header for authenticated protected paths', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: 'supabase-jwt-token-abc' } },
    });
    const upstream = okResponse({ cycles: [] });
    mockProxyServiceRequest.mockResolvedValueOnce(upstream);

    const request = new Request('https://sentinel.example/api/agents/cycles');
    const ctx = { params: Promise.resolve({ path: ['cycles'] }) };

    const response = await handle(request, ctx);

    expect(mockProxyServiceRequest).toHaveBeenCalledWith('agents', request, ['cycles'], {
      Authorization: 'Bearer supabase-jwt-token-abc',
    });
    expect(response).toBe(upstream);
  });

  it('returns 401 when getSession throws', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('Supabase connection error'));

    const request = new Request('https://sentinel.example/api/agents/run');
    const ctx = { params: Promise.resolve({ path: ['run'] }) };

    const response = await handle(request, ctx);

    expect(response.status).toBe(401);
    expect(mockProxyServiceRequest).not.toHaveBeenCalled();
  });

  it('supports POST method via the same handler', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: 'jwt-xyz' } },
    });
    const upstream = okResponse({ started: true });
    mockProxyServiceRequest.mockResolvedValueOnce(upstream);

    // Import the POST export to confirm all methods are wired
    const mod = await import('@/app/api/agents/[...path]/route');
    const POST = mod.POST;

    const request = new Request('https://sentinel.example/api/agents/cycles/run', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const ctx = { params: Promise.resolve({ path: ['cycles', 'run'] }) };

    const response = await POST(request, ctx);

    expect(mockProxyServiceRequest).toHaveBeenCalledWith(
      'agents',
      request,
      ['cycles', 'run'],
      { Authorization: 'Bearer jwt-xyz' },
    );
    expect(response).toBe(upstream);
  });
});
