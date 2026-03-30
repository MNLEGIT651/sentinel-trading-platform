import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Supabase mock ──────────────────────────────────────────────────

const mockUser = { id: 'user-adv', email: 'advisor@test.com' };
const mockGetUser = vi.fn();

type ChainResult = { data: unknown; error: unknown; count?: number };

let fromResults: Record<string, ChainResult> = {};

function chainFor(table: string) {
  const result = fromResults[table] ?? { data: null, error: null };
  const chain: Record<string, unknown> = {};
  const proxy: Record<string, unknown> = new Proxy(chain, {
    get(_t, prop: string) {
      if (prop === 'data') return result.data;
      if (prop === 'error') return result.error;
      if (prop === 'count') return result.count ?? null;
      if (prop === 'single') return () => result;
      if (prop === 'then') return undefined;
      return () => proxy;
    },
  });
  return proxy;
}

const mockFrom = vi.fn((table: string) => chainFor(table));

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

function req(url: string, opts?: RequestInit) {
  return new Request(`http://localhost${url}`, opts);
}

function jsonReq(url: string, body: unknown) {
  return req(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function patchReq(url: string, body: unknown) {
  return req(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

// ─── Tests ──────────────────────────────────────────────────────────

describe('Advisor Routes — Threads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromResults = {};
  });

  describe('GET /api/advisor/threads', () => {
    it('returns 401 when unauthenticated', async () => {
      unauthed();
      const { GET } = await import('@/app/api/advisor/threads/route');
      const res = await GET(req('/api/advisor/threads'));
      expect(res.status).toBe(401);
    });

    it('returns threads list on success', async () => {
      authed();
      const threads = [{ id: 't1', title: 'Thread 1' }];
      fromResults['advisor_threads'] = { data: threads, error: null, count: 1 };

      const { GET } = await import('@/app/api/advisor/threads/route');
      const res = await GET(req('/api/advisor/threads'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.threads).toBeDefined();
    });

    it('returns 500 on db error', async () => {
      authed();
      fromResults['advisor_threads'] = { data: null, error: { message: 'DB down' } };

      const { GET } = await import('@/app/api/advisor/threads/route');
      const res = await GET(req('/api/advisor/threads'));
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/advisor/threads', () => {
    it('returns 401 when unauthenticated', async () => {
      unauthed();
      const { POST } = await import('@/app/api/advisor/threads/route');
      const res = await POST(jsonReq('/api/advisor/threads', { title: 'New' }));
      expect(res.status).toBe(401);
    });

    it('creates thread with 201', async () => {
      authed();
      fromResults['advisor_threads'] = {
        data: { id: 't-new', title: 'New', user_id: 'user-adv' },
        error: null,
      };

      const { POST } = await import('@/app/api/advisor/threads/route');
      const res = await POST(jsonReq('/api/advisor/threads', { title: 'New' }));
      expect(res.status).toBe(201);
    });

    it('returns 400 on invalid JSON body', async () => {
      authed();
      const { POST } = await import('@/app/api/advisor/threads/route');
      const res = await POST(
        req('/api/advisor/threads', {
          method: 'POST',
          body: 'not-json',
          headers: { 'content-type': 'application/json' },
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/advisor/threads/[id]', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { GET } = await import('@/app/api/advisor/threads/[id]/route');
      const res = await GET(req('/api/advisor/threads/t1') as never, params('t1'));
      expect(res.status).toBe(401);
    });

    it('returns 404 when thread not found', async () => {
      authed();
      fromResults['advisor_threads'] = { data: null, error: { code: 'PGRST116' } };

      const { GET } = await import('@/app/api/advisor/threads/[id]/route');
      const res = await GET(req('/api/advisor/threads/bad') as never, params('bad'));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/advisor/threads/[id]', () => {
    it('returns 400 when no fields provided', async () => {
      authed();
      const { PATCH } = await import('@/app/api/advisor/threads/[id]/route');
      const res = await PATCH(patchReq('/api/advisor/threads/t1', {}) as never, params('t1'));
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/advisor/threads/[id]', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { DELETE } = await import('@/app/api/advisor/threads/[id]/route');
      const res = await DELETE(req('/api/advisor/threads/t1') as never, params('t1'));
      expect(res.status).toBe(401);
    });
  });
});

// ─── Preferences ────────────────────────────────────────────────────

describe('Advisor Routes — Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromResults = {};
  });

  describe('GET /api/advisor/preferences', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { GET } = await import('@/app/api/advisor/preferences/route');
      const res = await GET(req('/api/advisor/preferences'));
      expect(res.status).toBe(401);
    });

    it('returns preferences with count', async () => {
      authed();
      fromResults['advisor_preferences'] = {
        data: [{ id: 'p1', category: 'sector', content: 'Avoid biotech' }],
        error: null,
        count: 1,
      };

      const { GET } = await import('@/app/api/advisor/preferences/route');
      const res = await GET(req('/api/advisor/preferences'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.preferences).toBeDefined();
      expect(body.total).toBeDefined();
    });
  });

  describe('POST /api/advisor/preferences', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { POST } = await import('@/app/api/advisor/preferences/route');
      const res = await POST(
        jsonReq('/api/advisor/preferences', { category: 'sector', content: 'test' }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when category missing', async () => {
      authed();
      const { POST } = await import('@/app/api/advisor/preferences/route');
      const res = await POST(jsonReq('/api/advisor/preferences', { content: 'test' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when content missing', async () => {
      authed();
      const { POST } = await import('@/app/api/advisor/preferences/route');
      const res = await POST(jsonReq('/api/advisor/preferences', { category: 'sector' }));
      expect(res.status).toBe(400);
    });

    it('creates preference with 201 and logs memory event', async () => {
      authed();
      const createdPref = {
        id: 'p-new',
        user_id: 'user-adv',
        category: 'sector',
        content: 'Avoid biotech',
        source: 'explicit',
        status: 'active',
        confidence: 1.0,
      };
      fromResults['advisor_preferences'] = { data: createdPref, error: null };
      fromResults['advisor_memory_events'] = { data: { id: 'e1' }, error: null };

      const { POST } = await import('@/app/api/advisor/preferences/route');
      const res = await POST(
        jsonReq('/api/advisor/preferences', {
          category: 'sector',
          content: 'Avoid biotech',
        }),
      );
      expect(res.status).toBe(201);

      // Verify memory event was logged
      expect(mockFrom).toHaveBeenCalledWith('advisor_memory_events');
    });
  });

  describe('POST /api/advisor/preferences/[id]/confirm', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { POST } = await import('@/app/api/advisor/preferences/[id]/confirm/route');
      const res = await POST(req('/api/advisor/preferences/p1/confirm') as never, params('p1'));
      expect(res.status).toBe(401);
    });

    it('returns 404 when preference not found', async () => {
      authed();
      fromResults['advisor_preferences'] = { data: null, error: { code: 'PGRST116' } };

      const { POST } = await import('@/app/api/advisor/preferences/[id]/confirm/route');
      const res = await POST(req('/api/advisor/preferences/bad/confirm') as never, params('bad'));
      expect(res.status).toBe(404);
    });

    it('returns 400 when preference is not pending', async () => {
      authed();
      fromResults['advisor_preferences'] = {
        data: { id: 'p1', status: 'active' },
        error: null,
      };

      const { POST } = await import('@/app/api/advisor/preferences/[id]/confirm/route');
      const res = await POST(req('/api/advisor/preferences/p1/confirm') as never, params('p1'));
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/advisor/preferences/[id]/dismiss', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { POST } = await import('@/app/api/advisor/preferences/[id]/dismiss/route');
      const res = await POST(req('/api/advisor/preferences/p1/dismiss') as never, params('p1'));
      expect(res.status).toBe(401);
    });

    it('returns 400 when preference is not pending', async () => {
      authed();
      fromResults['advisor_preferences'] = {
        data: { id: 'p1', status: 'active' },
        error: null,
      };

      const { POST } = await import('@/app/api/advisor/preferences/[id]/dismiss/route');
      const res = await POST(req('/api/advisor/preferences/p1/dismiss') as never, params('p1'));
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/advisor/preferences/[id]', () => {
    it('returns 404 when preference not found', async () => {
      authed();
      fromResults['advisor_preferences'] = { data: null, error: null };

      const { PATCH } = await import('@/app/api/advisor/preferences/[id]/route');
      const res = await PATCH(
        patchReq('/api/advisor/preferences/p1', { content: 'new' }) as never,
        params('p1'),
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 when no fields to update', async () => {
      authed();
      fromResults['advisor_preferences'] = {
        data: { id: 'p1', content: 'old' },
        error: null,
      };

      const { PATCH } = await import('@/app/api/advisor/preferences/[id]/route');
      const res = await PATCH(patchReq('/api/advisor/preferences/p1', {}) as never, params('p1'));
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/advisor/preferences/[id]', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { DELETE } = await import('@/app/api/advisor/preferences/[id]/route');
      const res = await DELETE(req('/api/advisor/preferences/p1') as never, params('p1'));
      expect(res.status).toBe(401);
    });

    it('returns 404 when preference not found', async () => {
      authed();
      fromResults['advisor_preferences'] = { data: null, error: null };

      const { DELETE } = await import('@/app/api/advisor/preferences/[id]/route');
      const res = await DELETE(req('/api/advisor/preferences/p1') as never, params('p1'));
      expect(res.status).toBe(404);
    });
  });
});

// ─── Messages ───────────────────────────────────────────────────────

describe('Advisor Routes — Messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromResults = {};
  });

  describe('GET /api/advisor/threads/[id]/messages', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { GET } = await import('@/app/api/advisor/threads/[id]/messages/route');
      const res = await GET(req('/api/advisor/threads/t1/messages') as never, params('t1'));
      expect(res.status).toBe(401);
    });

    it('returns 404 when thread not owned by user', async () => {
      authed();
      fromResults['advisor_threads'] = { data: null, error: { code: 'PGRST116' } };

      const { GET } = await import('@/app/api/advisor/threads/[id]/messages/route');
      const res = await GET(
        req('/api/advisor/threads/foreign/messages') as never,
        params('foreign'),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/advisor/threads/[id]/messages', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { POST } = await import('@/app/api/advisor/threads/[id]/messages/route');
      const res = await POST(
        jsonReq('/api/advisor/threads/t1/messages', {
          role: 'user',
          content: 'Hello',
        }) as never,
        params('t1'),
      );
      expect(res.status).toBe(401);
    });

    it('returns 404 when thread not found', async () => {
      authed();
      fromResults['advisor_threads'] = { data: null, error: { code: 'PGRST116' } };

      const { POST } = await import('@/app/api/advisor/threads/[id]/messages/route');
      const res = await POST(
        jsonReq('/api/advisor/threads/bad/messages', {
          role: 'user',
          content: 'Hello',
        }) as never,
        params('bad'),
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 when role or content missing', async () => {
      authed();
      fromResults['advisor_threads'] = {
        data: { id: 't1', message_count: 0 },
        error: null,
      };

      const { POST } = await import('@/app/api/advisor/threads/[id]/messages/route');
      const res = await POST(
        jsonReq('/api/advisor/threads/t1/messages', { role: 'user' }) as never,
        params('t1'),
      );
      expect(res.status).toBe(400);
    });
  });
});

// ─── Memory Events ──────────────────────────────────────────────────

describe('Advisor Routes — Memory Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromResults = {};
  });

  describe('GET /api/advisor/memory-events', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { GET } = await import('@/app/api/advisor/memory-events/route');
      const res = await GET(req('/api/advisor/memory-events'));
      expect(res.status).toBe(401);
    });

    it('returns events on success', async () => {
      authed();
      fromResults['advisor_memory_events'] = {
        data: [{ id: 'e1', event_type: 'preference_learned' }],
        error: null,
        count: 1,
      };

      const { GET } = await import('@/app/api/advisor/memory-events/route');
      const res = await GET(req('/api/advisor/memory-events'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.events).toBeDefined();
      expect(body.total).toBeDefined();
    });
  });
});

// ─── Context ────────────────────────────────────────────────────────

describe('Advisor Routes — Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromResults = {};
  });

  describe('GET /api/advisor/context', () => {
    it('returns 401 unauthenticated', async () => {
      unauthed();
      const { GET } = await import('@/app/api/advisor/context/route');
      const res = await GET(req('/api/advisor/context'));
      expect(res.status).toBe(401);
    });
  });
});
