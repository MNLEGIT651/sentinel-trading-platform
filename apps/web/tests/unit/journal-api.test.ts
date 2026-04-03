import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock ──────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelectSingle = vi.fn();

function chainable(terminal?: () => unknown) {
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(_t, prop: string) {
      if (prop === 'then') return undefined;
      if (prop === 'single') return terminal ?? (() => ({ data: null, error: null }));
      if (prop === 'select') return () => proxy;
      if (prop === 'eq') return () => proxy;
      if (prop === 'maybeSingle') return terminal ?? (() => ({ data: null, error: null }));
      if (prop === 'order') return () => proxy;
      if (prop === 'range') return () => proxy;
      if (prop === 'gte') return () => proxy;
      if (prop === 'lte') return () => proxy;
      return () => proxy;
    },
  });
  return proxy;
}

const mockFrom = vi.fn((table: string) => {
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(_t, prop: string) {
      if (prop === 'then') return undefined;
      if (prop === 'insert')
        return (data: unknown) => {
          mockInsert(data);
          return chainable(mockSelectSingle);
        };
      if (prop === 'update')
        return (data: unknown) => {
          mockUpdate(data);
          return chainable(mockSelectSingle);
        };
      if (prop === 'select') return () => proxy;
      if (prop === 'eq') return () => proxy;
      if (prop === 'maybeSingle') return () => ({ data: null, error: null });
      if (prop === 'single') return () => ({ data: null, error: null });
      if (prop === 'order') return () => proxy;
      if (prop === 'range') return () => proxy;
      if (prop === 'gte') return () => proxy;
      if (prop === 'lte') return () => proxy;
      return () => proxy;
    },
  });
  void table;
  return proxy;
});

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// ─── Rate limiter mock ──────────────────────────────────────────────

vi.mock('@/lib/server/rate-limiter', () => ({
  checkApiRateLimit: vi.fn(() => null),
}));

// ─── Helpers ────────────────────────────────────────────────────────

const TEST_USER = { id: 'aabbccdd-1234-5678-abcd-aabbccddeeff' };

function authed() {
  mockGetUser.mockResolvedValue({ data: { user: TEST_USER }, error: null });
}

function unauthed() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No auth' } });
}

function req(url: string, method = 'GET', body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    ...(body
      ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
      : method === 'POST' || method === 'PATCH'
        ? { body: '{}', headers: { 'content-type': 'application/json' } }
        : {}),
  });
}

const VALID_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_REC_ID = '11111111-2222-3333-4444-555555555555';
const VALID_ORDER_ID = '66666666-7777-8888-9999-aaaaaaaaaaaa';

// ─── Tests ──────────────────────────────────────────────────────────

describe('Journal API routes', { timeout: 15_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Auth enforcement ───────────────────────────────────────────

  describe('Auth enforcement', () => {
    beforeEach(() => unauthed());

    it('GET /api/journal returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/journal/route');
      const res = await GET(req('/api/journal'));
      expect(res.status).toBe(401);
    });

    it('POST /api/journal returns 401 when unauthenticated', async () => {
      const { POST } = await import('@/app/api/journal/route');
      const res = await POST(req('/api/journal', 'POST'));
      expect(res.status).toBe(401);
    });

    it('GET /api/journal/[id] returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/journal/[id]/route');
      const res = await GET(req(`/api/journal/${VALID_UUID}`), {
        params: Promise.resolve({ id: VALID_UUID }),
      });
      expect(res.status).toBe(401);
    });

    it('PATCH /api/journal/[id] returns 401 when unauthenticated', async () => {
      const { PATCH } = await import('@/app/api/journal/[id]/route');
      const res = await PATCH(req(`/api/journal/${VALID_UUID}`, 'PATCH'), {
        params: Promise.resolve({ id: VALID_UUID }),
      });
      expect(res.status).toBe(401);
    });

    it('GET /api/journal/stats returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/journal/stats/route');
      const res = await GET(req('/api/journal/stats'));
      expect(res.status).toBe(401);
    });
  });

  // ─── POST with linkage fields ──────────────────────────────────

  describe('POST /api/journal — linkage fields', () => {
    beforeEach(() => {
      authed();
    });

    it('accepts entry with order_id and recommendation_id', async () => {
      const entry = {
        event_type: 'fill',
        order_id: VALID_ORDER_ID,
        recommendation_id: VALID_REC_ID,
      };
      mockSelectSingle.mockReturnValue({
        data: { id: VALID_UUID, ...entry, user_id: TEST_USER.id },
        error: null,
      });

      const { POST } = await import('@/app/api/journal/route');
      const res = await POST(req('/api/journal', 'POST', entry));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.order_id).toBe(VALID_ORDER_ID);
      expect(body.recommendation_id).toBe(VALID_REC_ID);
    });

    it('accepts entry without linkage fields (backward compatible)', async () => {
      const entry = { event_type: 'manual_note' };
      mockSelectSingle.mockReturnValue({
        data: {
          id: VALID_UUID,
          ...entry,
          user_id: TEST_USER.id,
          order_id: null,
          recommendation_id: null,
        },
        error: null,
      });

      const { POST } = await import('@/app/api/journal/route');
      const res = await POST(req('/api/journal', 'POST', entry));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.order_id).toBeNull();
      expect(body.recommendation_id).toBeNull();
    });

    it('rejects entry with invalid order_id UUID', async () => {
      const entry = { event_type: 'fill', order_id: 'not-a-uuid' };

      const { POST } = await import('@/app/api/journal/route');
      const res = await POST(req('/api/journal', 'POST', entry));
      expect(res.status).toBe(400);
    });

    it('rejects entry with invalid recommendation_id UUID', async () => {
      const entry = { event_type: 'fill', recommendation_id: 'bad' };

      const { POST } = await import('@/app/api/journal/route');
      const res = await POST(req('/api/journal', 'POST', entry));
      expect(res.status).toBe(400);
    });

    it('accepts null linkage fields', async () => {
      const entry = { event_type: 'recommendation', order_id: null, recommendation_id: null };
      mockSelectSingle.mockReturnValue({
        data: { id: VALID_UUID, ...entry, user_id: TEST_USER.id },
        error: null,
      });

      const { POST } = await import('@/app/api/journal/route');
      const res = await POST(req('/api/journal', 'POST', entry));
      expect(res.status).toBe(201);
    });
  });

  // ─── PATCH with linkage fields ─────────────────────────────────

  describe('PATCH /api/journal/[id] — linkage fields', () => {
    beforeEach(() => {
      authed();
    });

    it('updates order_id linkage on existing entry', async () => {
      const update = { order_id: VALID_ORDER_ID };
      mockSelectSingle.mockReturnValue({
        data: { id: VALID_UUID, order_id: VALID_ORDER_ID, user_id: TEST_USER.id },
        error: null,
      });

      const { PATCH } = await import('@/app/api/journal/[id]/route');
      const res = await PATCH(req(`/api/journal/${VALID_UUID}`, 'PATCH', update), {
        params: Promise.resolve({ id: VALID_UUID }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.order_id).toBe(VALID_ORDER_ID);
    });

    it('updates recommendation_id linkage on existing entry', async () => {
      const update = { recommendation_id: VALID_REC_ID };
      mockSelectSingle.mockReturnValue({
        data: { id: VALID_UUID, recommendation_id: VALID_REC_ID, user_id: TEST_USER.id },
        error: null,
      });

      const { PATCH } = await import('@/app/api/journal/[id]/route');
      const res = await PATCH(req(`/api/journal/${VALID_UUID}`, 'PATCH', update), {
        params: Promise.resolve({ id: VALID_UUID }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.recommendation_id).toBe(VALID_REC_ID);
    });

    it('rejects PATCH with invalid UUID in linkage field', async () => {
      const update = { order_id: 'invalid' };

      const { PATCH } = await import('@/app/api/journal/[id]/route');
      const res = await PATCH(req(`/api/journal/${VALID_UUID}`, 'PATCH', update), {
        params: Promise.resolve({ id: VALID_UUID }),
      });
      expect(res.status).toBe(400);
    });

    it('clears linkage fields with null', async () => {
      const update = { order_id: null };
      mockSelectSingle.mockReturnValue({
        data: { id: VALID_UUID, order_id: null, user_id: TEST_USER.id },
        error: null,
      });

      const { PATCH } = await import('@/app/api/journal/[id]/route');
      const res = await PATCH(req(`/api/journal/${VALID_UUID}`, 'PATCH', update), {
        params: Promise.resolve({ id: VALID_UUID }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.order_id).toBeNull();
    });
  });
});
