import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock Supabase ──────────────────────────────────────────────────

const mockUser = { id: 'user-abc', email: 'test@example.com' };
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

import { POST } from '@/app/api/onboarding/paper-account/route';

describe('/api/onboarding/paper-account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns existing paper account with already_existed flag', async () => {
    const existingAccount = { id: 'acc-existing', broker: 'paper' };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingAccount, error: null }),
          }),
        }),
      }),
    });

    const res = await POST();
    const body = await res.json();
    expect(body.id).toBe('acc-existing');
    expect(body.already_existed).toBe(true);
  });

  it('creates new paper account with $100,000 initial capital', async () => {
    let insertedData: Record<string, unknown> | undefined;
    const newAccount = { id: 'acc-new' };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockImplementation((data: unknown) => {
            insertedData = data as Record<string, unknown>;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: newAccount, error: null }),
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
    expect(insertedData!.initial_capital).toBe(100000);
    expect(insertedData!.is_active).toBe(true);
    expect(insertedData!.is_default).toBe(true);
    expect(insertedData!.broker).toBe('paper');
  });
});
