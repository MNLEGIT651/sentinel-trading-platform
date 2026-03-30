import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Supabase mock ──────────────────────────────────────────────────

const mockUser = { id: 'user-exp', email: 'exp@test.com' };
const mockGetUser = vi.fn();

type ChainResult = { data: unknown; error: unknown };

let insertResults: ChainResult[] = [];
let selectResult: ChainResult = { data: null, error: null };

function makeChain(forInsert = false) {
  const chain: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = new Proxy(chain, {
    get(_t, prop: string) {
      if (prop === 'single') {
        if (forInsert && insertResults.length > 0) {
          return () => insertResults.shift()!;
        }
        return () => selectResult;
      }
      if (prop === 'data') return selectResult.data;
      if (prop === 'error') return selectResult.error;
      if (prop === 'then') return undefined;
      if (prop === 'insert')
        return () => {
          forInsert = true;
          return proxy;
        };
      return () => proxy;
    },
  });
  return proxy;
}

const mockFrom = vi.fn(() => makeChain());

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// ─── Helpers ────────────────────────────────────────────────────────

function authed() {
  mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
}

function unauthed() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No auth' } });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonReq(url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Explanation Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = { data: null, error: null };
    insertResults = [];
  });

  describe('GET /api/recommendations/[id]/explanation', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { GET } = await import('@/app/api/recommendations/[id]/explanation/route');
      const res = await GET(
        new Request('http://localhost/api/recommendations/r1/explanation') as never,
        params('r1'),
      );
      expect(res.status).toBe(401);
    });

    it('returns 404 when no explanation exists', async () => {
      authed();
      selectResult = { data: null, error: { code: 'PGRST116' } };

      const { GET } = await import('@/app/api/recommendations/[id]/explanation/route');
      const res = await GET(
        new Request('http://localhost/api/recommendations/r1/explanation') as never,
        params('r1'),
      );
      expect(res.status).toBe(404);
    });

    it('returns explanation on success', async () => {
      authed();
      selectResult = {
        data: {
          id: 'exp1',
          recommendation_id: 'r1',
          summary: 'Test explanation',
          version: 1,
        },
        error: null,
      };

      const { GET } = await import('@/app/api/recommendations/[id]/explanation/route');
      const res = await GET(
        new Request('http://localhost/api/recommendations/r1/explanation') as never,
        params('r1'),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.summary).toBe('Test explanation');
    });
  });

  describe('POST /api/recommendations/[id]/explanation', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { POST } = await import('@/app/api/recommendations/[id]/explanation/route');
      const res = await POST(
        jsonReq('/api/recommendations/r1/explanation', {
          summary: 'test',
          explanation: { summary: 'test', confidence: 0.8, generated_at: new Date().toISOString() },
        }) as never,
        params('r1'),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when summary missing', async () => {
      authed();
      const { POST } = await import('@/app/api/recommendations/[id]/explanation/route');
      const res = await POST(
        jsonReq('/api/recommendations/r1/explanation', {
          explanation: { summary: 'test', confidence: 0.8, generated_at: new Date().toISOString() },
        }) as never,
        params('r1'),
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when explanation missing', async () => {
      authed();
      const { POST } = await import('@/app/api/recommendations/[id]/explanation/route');
      const res = await POST(
        jsonReq('/api/recommendations/r1/explanation', { summary: 'test' }) as never,
        params('r1'),
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 on invalid JSON body', async () => {
      authed();
      const { POST } = await import('@/app/api/recommendations/[id]/explanation/route');
      const res = await POST(
        new Request('http://localhost/api/recommendations/r1/explanation', {
          method: 'POST',
          body: 'not-json',
          headers: { 'content-type': 'application/json' },
        }) as never,
        params('r1'),
      );
      expect(res.status).toBe(400);
    });
  });
});
