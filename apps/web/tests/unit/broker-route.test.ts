import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock Supabase ──────────────────────────────────────────────────

const mockUser = { id: 'user-789', email: 'test@example.com' };
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/api-error', () => ({
  safeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

import { GET, POST, PUT } from '@/app/api/onboarding/broker/route';

function makeRequest(method: string, body?: unknown): Request {
  const opts: RequestInit = { method, headers: { 'content-type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return new Request('http://localhost/api/onboarding/broker', opts);
}

describe('/api/onboarding/broker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── GET ────────────────────────────────────────────────────────

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns null when no broker account exists', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toBeNull();
    });

    it('returns broker account when it exists', async () => {
      const mockAccount = {
        id: 'ba-1',
        user_id: mockUser.id,
        status: 'pending',
        broker_provider: 'alpaca',
      };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockAccount, error: null }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('pending');
    });
  });

  // ─── POST ───────────────────────────────────────────────────────

  describe('POST', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await POST();
      expect(res.status).toBe(401);
    });

    it('returns 409 when broker account already exists', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'existing-ba', status: 'pending' },
              error: null,
            }),
          }),
        }),
      });

      const res = await POST();
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('already exists');
    });

    it('creates broker account with correct defaults', async () => {
      let insertedData: Record<string, unknown> | undefined;
      const createdAccount = {
        id: 'ba-new',
        user_id: mockUser.id,
        broker_provider: 'alpaca',
        status: 'pending',
        account_type: 'individual',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'broker_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: vi.fn().mockImplementation((data: unknown) => {
              insertedData = data as Record<string, unknown>;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: createdAccount, error: null }),
                }),
              };
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const res = await POST();
      expect(res.status).toBe(201);

      expect(insertedData).toBeDefined();
      expect(insertedData!.broker_provider).toBe('alpaca');
      expect(insertedData!.status).toBe('pending');
      expect(insertedData!.account_type).toBe('individual');
    });
  });

  // ─── PUT ────────────────────────────────────────────────────────

  describe('PUT', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const req = makeRequest('PUT', { status: 'submitted' });
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });

    it('rejects updates with no valid fields', async () => {
      const req = makeRequest('PUT', { invalid_field: 'value' });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('accepts status update', async () => {
      const updatedAccount = {
        id: 'ba-1',
        user_id: mockUser.id,
        status: 'submitted',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'broker_accounts') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedAccount, error: null }),
                }),
              }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const req = makeRequest('PUT', { status: 'submitted' });
      const res = await PUT(req);
      expect(res.status).toBe(200);
    });

    it('accepts external_account_id update', async () => {
      const updatedAccount = {
        id: 'ba-1',
        user_id: mockUser.id,
        external_account_id: 'alpaca-ext-123',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'broker_accounts') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedAccount, error: null }),
                }),
              }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const req = makeRequest('PUT', { external_account_id: 'alpaca-ext-123' });
      const res = await PUT(req);
      expect(res.status).toBe(200);
    });
  });
});
