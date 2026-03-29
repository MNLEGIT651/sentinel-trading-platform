import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock Supabase ──────────────────────────────────────────────────

const mockUser = { id: 'user-fund', email: 'test@example.com' };
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

import { GET, POST } from '@/app/api/funding/route';

function makeGetRequest(view?: string): Request {
  const url = view ? `http://localhost/api/funding?view=${view}` : 'http://localhost/api/funding';
  return new Request(url, { method: 'GET' });
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/funding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/funding', () => {
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
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(401);
    });

    it('returns both bank_links and transactions by default', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'bank_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [{ id: 'bl-1' }], error: null }),
              }),
            }),
          };
        }
        if (table === 'funding_transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [{ id: 'ft-1' }], error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await GET(makeGetRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('bank_links');
      expect(body).toHaveProperty('transactions');
    });

    it('returns only bank_links when view=bank-links', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [{ id: 'bl-1' }], error: null }),
          }),
        }),
      });

      const res = await GET(makeGetRequest('bank-links'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('returns only transactions when view=transactions', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{ id: 'ft-1' }], error: null }),
            }),
          }),
        }),
      });

      const res = await GET(makeGetRequest('transactions'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ─── POST ───────────────────────────────────────────────────────

  describe('POST', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await POST(makePostRequest({ action: 'create_bank_link' }));
      expect(res.status).toBe(401);
    });

    it('rejects missing action', async () => {
      const res = await POST(makePostRequest({}));
      expect(res.status).toBe(400);
    });

    it('rejects unknown action', async () => {
      const res = await POST(makePostRequest({ action: 'unknown_action' }));
      expect(res.status).toBe(400);
    });

    // ─── create_bank_link ─────────────────────────────────────────

    describe('action: create_bank_link', () => {
      it('rejects without broker_account_id', async () => {
        const res = await POST(
          makePostRequest({
            action: 'create_bank_link',
          }),
        );
        expect(res.status).toBe(400);
      });

      it('creates bank link on success', async () => {
        const mockBankLink = { id: 'bl-new', status: 'pending' };

        mockFrom.mockImplementation((table: string) => {
          if (table === 'bank_links') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockBankLink, error: null }),
                }),
              }),
            };
          }
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        });

        const res = await POST(
          makePostRequest({
            action: 'create_bank_link',
            broker_account_id: 'ba-123',
            bank_name: 'Chase',
            account_last4: '1234',
          }),
        );
        expect(res.status).toBe(201);
      });
    });

    // ─── transfer ─────────────────────────────────────────────────

    describe('action: transfer', () => {
      it('rejects without required fields', async () => {
        const res = await POST(
          makePostRequest({
            action: 'transfer',
            direction: 'deposit',
          }),
        );
        expect(res.status).toBe(400);
      });

      it('rejects zero amount', async () => {
        const res = await POST(
          makePostRequest({
            action: 'transfer',
            direction: 'deposit',
            amount: 0,
            bank_link_id: 'bl-1',
            broker_account_id: 'ba-1',
          }),
        );
        expect(res.status).toBe(400);
      });

      it('rejects negative amount', async () => {
        const res = await POST(
          makePostRequest({
            action: 'transfer',
            direction: 'deposit',
            amount: -100,
            bank_link_id: 'bl-1',
            broker_account_id: 'ba-1',
          }),
        );
        expect(res.status).toBe(400);
      });

      it('rejects invalid direction', async () => {
        const res = await POST(
          makePostRequest({
            action: 'transfer',
            direction: 'invalid',
            amount: 500,
            bank_link_id: 'bl-1',
            broker_account_id: 'ba-1',
          }),
        );
        expect(res.status).toBe(400);
      });

      it('creates transfer on success', async () => {
        const mockTxn = { id: 'ft-new', status: 'pending', amount: 500 };

        mockFrom.mockImplementation((table: string) => {
          if (table === 'funding_transactions') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockTxn, error: null }),
                }),
              }),
            };
          }
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        });

        const res = await POST(
          makePostRequest({
            action: 'transfer',
            direction: 'deposit',
            amount: 500,
            bank_link_id: 'bl-1',
            broker_account_id: 'ba-1',
          }),
        );
        expect(res.status).toBe(201);
      });
    });
  });
});
