import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockProxyServiceRequest = vi.fn();
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockProfileSingle = vi.fn();
const mockRequireRole = vi.fn();

vi.mock('@/lib/server/service-proxy', () => ({
  proxyServiceRequest: (...args: unknown[]) => mockProxyServiceRequest(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      single: mockProfileSingle,
    })),
  }),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

function okResponse(body: Record<string, unknown> = { status: 'ok' }): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('/api/engine/[...path] route handler', () => {
  let GET: (req: Request, ctx: { params: Promise<{ path?: string[] }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRequireRole.mockResolvedValue({ user: { id: 'op-1' }, supabase: {} });
    const mod = await import('@/app/api/engine/[...path]/route');
    GET = mod.GET;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('allows public /health without auth', async () => {
    mockProxyServiceRequest.mockResolvedValueOnce(okResponse());
    const req = new Request('https://x/api/engine/health');
    const res = await GET(req, { params: Promise.resolve({ path: ['health'] }) });
    expect(res.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('allows authenticated safe reads', async () => {
    mockProxyServiceRequest.mockResolvedValueOnce(okResponse({ account: true }));
    const req = new Request('https://x/api/engine/api/v1/portfolio/account');
    const res = await GET(req, { params: Promise.resolve({ path: ['api', 'v1', 'portfolio', 'account'] }) });
    expect(res.status).toBe(200);
    expect(mockProxyServiceRequest).toHaveBeenCalledOnce();
  });

  it('denies unknown reads by default', async () => {
    const req = new Request('https://x/api/engine/internal/debug');
    const res = await GET(req, { params: Promise.resolve({ path: ['internal', 'debug'] }) });
    expect(res.status).toBe(403);
  });

  it('requires auth on protected reads', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = new Request('https://x/api/engine/api/v1/portfolio/account');
    const res = await GET(req, { params: Promise.resolve({ path: ['api', 'v1', 'portfolio', 'account'] }) });
    expect(res.status).toBe(401);
  });

  it('requires operator role for privileged mutations', async () => {
    const mod = await import('@/app/api/engine/[...path]/route');
    const POST = mod.POST;
    const { NextResponse } = await import('next/server');
    mockRequireRole.mockResolvedValueOnce(
      NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    );
    const req = new Request('https://x/api/engine/api/v1/strategies/scan', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ path: ['api', 'v1', 'strategies', 'scan'] }) });
    expect(res.status).toBe(403);
    expect(mockProxyServiceRequest).not.toHaveBeenCalled();
  });

  it('allows authenticated portfolio order mutation', async () => {
    const mod = await import('@/app/api/engine/[...path]/route');
    const POST = mod.POST;
    mockProxyServiceRequest.mockResolvedValueOnce(okResponse({ submitted: true }));
    const req = new Request('https://x/api/engine/api/v1/portfolio/orders', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ path: ['api', 'v1', 'portfolio', 'orders'] }) });
    expect(res.status).toBe(200);
  });

  it('denies unknown mutations by default', async () => {
    const mod = await import('@/app/api/engine/[...path]/route');
    const DELETE = mod.DELETE;
    const req = new Request('https://x/api/engine/admin/reset', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ path: ['admin', 'reset'] }) });
    expect(res.status).toBe(403);
  });
});

describe('/api/agents/[...path] route handler', () => {
  let GET: (req: Request, ctx: { params: Promise<{ path?: string[] }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'jwt-token' } } });
    mockProfileSingle.mockResolvedValue({ data: { role: 'operator' }, error: null });
    const mod = await import('@/app/api/agents/[...path]/route');
    GET = mod.GET;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('allows /health publicly', async () => {
    mockProxyServiceRequest.mockResolvedValueOnce(okResponse());
    const req = new Request('https://x/api/agents/health');
    const res = await GET(req, { params: Promise.resolve({ path: ['health'] }) });
    expect(res.status).toBe(200);
  });

  it('allows authenticated safe reads and injects auth token', async () => {
    mockProxyServiceRequest.mockResolvedValueOnce(okResponse({ recommendations: [] }));
    const req = new Request('https://x/api/agents/recommendations');
    const res = await GET(req, { params: Promise.resolve({ path: ['recommendations'] }) });
    expect(res.status).toBe(200);
    expect(mockProxyServiceRequest).toHaveBeenCalledWith(
      'agents',
      req,
      ['recommendations'],
      expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
    );
  });

  it('requires auth for non-public paths', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = new Request('https://x/api/agents/recommendations');
    const res = await GET(req, { params: Promise.resolve({ path: ['recommendations'] }) });
    expect(res.status).toBe(401);
  });

  it('requires operator role for /halt', async () => {
    const mod = await import('@/app/api/agents/[...path]/route');
    const POST = mod.POST;
    mockProfileSingle.mockResolvedValueOnce({ data: { role: 'reviewer' }, error: null });
    const req = new Request('https://x/api/agents/halt', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ path: ['halt'] }) });
    expect(res.status).toBe(403);
  });

  it('denies unknown agents mutation paths by default', async () => {
    const mod = await import('@/app/api/agents/[...path]/route');
    const POST = mod.POST;
    const req = new Request('https://x/api/agents/admin/reset', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ path: ['admin', 'reset'] }) });
    expect(res.status).toBe(403);
  });
});
