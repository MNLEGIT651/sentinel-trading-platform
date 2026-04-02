import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';

// ─── Mock Setup ──────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'op@example.com' };
const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ user: mockUser, supabase: mockSupabase })),
  requireRole: vi.fn(async () => ({ user: mockUser, supabase: mockSupabase })),
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

import { GET, PATCH } from '@/app/api/system-controls/route';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/system-controls', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('/api/system-controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns system controls data', async () => {
      const controlsData = {
        id: 'ctrl-1',
        trading_halted: false,
        autonomy_mode: 'suggest',
        live_execution_enabled: true,
      };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: controlsData, error: null }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.trading_halted).toBe(false);
    });

    it('returns 500 on Supabase error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
            }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(500);
    });
  });

  describe('PATCH', () => {
    it('returns 401 when not authorized as operator', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      );

      const res = await PATCH(makePatchRequest({ trading_halted: true }));
      expect(res.status).toBe(403);
    });

    it('updates system controls', async () => {
      const updatedData = {
        id: 'ctrl-1',
        trading_halted: true,
        autonomy_mode: 'suggest',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'system_controls') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'ctrl-1' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: updatedData,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'operator_actions') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      const res = await PATCH(makePatchRequest({ trading_halted: true }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.trading_halted).toBe(true);
    });

    it('logs operator action on update', async () => {
      const insertFn = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'system_controls') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'ctrl-1' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'ctrl-1', trading_halted: true },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'operator_actions') {
          return { insert: insertFn };
        }
        return {};
      });

      await PATCH(makePatchRequest({ trading_halted: true }));

      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          operator_id: 'user-1',
          action_type: 'halt_trading',
          target_type: 'system_controls',
        }),
      );
    });
  });
});
