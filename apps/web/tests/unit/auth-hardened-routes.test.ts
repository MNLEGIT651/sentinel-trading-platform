import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Verify that routes hardened during the production audit
 * correctly reject unauthenticated requests with 401.
 */

// ─── Supabase mock ──────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockFrom = vi.fn(() => {
  const chain: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = new Proxy(chain, {
    get(_t, prop: string) {
      if (prop === 'data') return null;
      if (prop === 'error') return null;
      if (prop === 'single') return () => ({ data: null, error: null });
      if (prop === 'then') return undefined;
      return () => proxy;
    },
  });
  return proxy;
});

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// supabaseAdmin for experiments
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}));

function unauthed() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No auth' } });
}

function req(url: string, method = 'GET') {
  return new Request(`http://localhost${url}`, {
    method,
    ...(method === 'POST' || method === 'PATCH'
      ? { body: '{}', headers: { 'content-type': 'application/json' } }
      : {}),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Auth enforcement on hardened routes', { timeout: 15_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unauthed();
  });

  it('GET /api/fills returns 401', async () => {
    const { GET } = await import('@/app/api/fills/route');
    const res = await GET(req('/api/fills'));
    expect(res.status).toBe(401);
  });

  it('POST /api/fills returns 401', async () => {
    const { POST } = await import('@/app/api/fills/route');
    const res = await POST(req('/api/fills', 'POST'));
    expect(res.status).toBe(401);
  });

  it('GET /api/catalysts returns 401', async () => {
    const { GET } = await import('@/app/api/catalysts/route');
    const res = await GET(req('/api/catalysts'));
    expect(res.status).toBe(401);
  });

  it('POST /api/catalysts returns 401', async () => {
    const { POST } = await import('@/app/api/catalysts/route');
    const res = await POST(req('/api/catalysts', 'POST'));
    expect(res.status).toBe(401);
  });

  it('GET /api/risk-evaluations returns 401', async () => {
    const { GET } = await import('@/app/api/risk-evaluations/route');
    const res = await GET(req('/api/risk-evaluations') as never);
    expect(res.status).toBe(401);
  });

  it('POST /api/risk-evaluations returns 401', async () => {
    const { POST } = await import('@/app/api/risk-evaluations/route');
    const res = await POST(req('/api/risk-evaluations', 'POST') as never);
    expect(res.status).toBe(401);
  });

  it('GET /api/experiments returns 401', async () => {
    const { GET } = await import('@/app/api/experiments/route');
    const res = await GET(req('/api/experiments') as never);
    expect(res.status).toBe(401);
  });

  it('POST /api/experiments returns 401', async () => {
    const { POST } = await import('@/app/api/experiments/route');
    const res = await POST(req('/api/experiments', 'POST') as never);
    expect(res.status).toBe(401);
  });

  it('GET /api/system-controls returns 401', async () => {
    const { GET } = await import('@/app/api/system-controls/route');
    const res = await GET(req('/api/system-controls'));
    expect(res.status).toBe(401);
  });

  it('PATCH /api/system-controls returns 401', async () => {
    const { PATCH } = await import('@/app/api/system-controls/route');
    const res = await PATCH(req('/api/system-controls', 'PATCH'));
    expect(res.status).toBe(401);
  });
});
