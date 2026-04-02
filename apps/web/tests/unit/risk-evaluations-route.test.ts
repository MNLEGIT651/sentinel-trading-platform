import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mock Setup ──────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ user: mockUser, supabase: mockSupabase })),
}));

vi.mock('@/lib/server/rate-limiter', () => ({
  checkApiRateLimit: vi.fn(() => null),
}));

vi.mock('@/lib/api-error', () => ({
  safeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock('@/lib/api/validation', () => ({
  parseBody: vi.fn(async (req: Request) => req.json()),
}));

import { GET, POST } from '@/app/api/risk-evaluations/route';
import { requireAuth } from '@/lib/auth/require-auth';

function makeGetRequest(params = ''): NextRequest {
  return new NextRequest(`http://localhost/api/risk-evaluations${params ? `?${params}` : ''}`);
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/risk-evaluations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('/api/risk-evaluations', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const res = await GET(makeGetRequest());
      expect(res.status).toBe(401);
    });

    it('returns paginated risk evaluations', async () => {
      const evals = [
        { id: 'eval-1', recommendation_id: 'rec-1', allowed: true, reason: null },
        { id: 'eval-2', recommendation_id: 'rec-2', allowed: false, reason: 'Position too large' },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: evals,
              error: null,
              count: 2,
            }),
          }),
        }),
      });

      const res = await GET(makeGetRequest());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.total).toBe(2);
    });

    it('filters by recommendation_id', async () => {
      const selectFn = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'eval-1', recommendation_id: 'rec-1', allowed: true }],
              error: null,
              count: 1,
            }),
          }),
        }),
      });

      mockFrom.mockReturnValue({ select: selectFn });

      const res = await GET(makeGetRequest('recommendation_id=rec-1'));
      expect(res.status).toBe(200);
    });

    it('returns 500 on Supabase error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
              count: null,
            }),
          }),
        }),
      });

      const res = await GET(makeGetRequest());
      expect(res.status).toBe(500);
    });
  });

  describe('POST', () => {
    it('creates a risk evaluation', async () => {
      const evalData = {
        id: 'eval-new',
        recommendation_id: 'rec-1',
        allowed: true,
        policy_version: 'v1',
      };

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: evalData, error: null }),
          }),
        }),
      });

      const res = await POST(
        makePostRequest({
          recommendation_id: 'rec-1',
          allowed: true,
          policy_version: 'v1',
        }),
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.recommendation_id).toBe('rec-1');
    });

    it('returns 500 on insert error', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'insert failed' },
            }),
          }),
        }),
      });

      const res = await POST(
        makePostRequest({
          recommendation_id: 'rec-1',
          allowed: false,
          reason: 'Position too large',
        }),
      );

      expect(res.status).toBe(500);
    });
  });
});
