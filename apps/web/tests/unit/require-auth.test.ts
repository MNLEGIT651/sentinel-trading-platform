import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// ─── Supabase mock ──────────────────────────────────────────────────

const mockUser = { id: 'user-100', email: 'auth@test.com' };
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// Import after mock
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import type { AuthContext } from '@/lib/auth/require-auth';

// ─── Helpers ────────────────────────────────────────────────────────

function profileRow(role: string) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => ({ data: { role }, error: null })),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AuthContext when user is authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const result = await requireAuth();

    expect(result).not.toBeInstanceOf(NextResponse);
    const ctx = result as AuthContext;
    expect(ctx.user.id).toBe('user-100');
    expect(ctx.supabase).toBeDefined();
  });

  it('returns 401 when getUser returns null user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('returns 401 when getUser returns an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireRole('operator');

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it('allows operator role for operator-level route', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFrom.mockReturnValue(profileRow('operator'));

    const result = await requireRole('operator');

    expect(result).not.toBeInstanceOf(NextResponse);
    const ctx = result as AuthContext;
    expect(ctx.user.id).toBe('user-100');
  });

  it('allows operator for reviewer-level route (higher privilege)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFrom.mockReturnValue(profileRow('operator'));

    const result = await requireRole('reviewer');

    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it('rejects observer for operator-level route', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFrom.mockReturnValue(profileRow('observer'));

    const result = await requireRole('operator');

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('forbidden');
  });

  it('rejects reviewer for approver-level route', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFrom.mockReturnValue(profileRow('reviewer'));

    const result = await requireRole('approver');

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it('fails closed when profile is not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => ({ data: null, error: { code: 'PGRST116' } })),
    });

    const result = await requireRole('operator');

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it('respects full role hierarchy: observer < reviewer < approver < operator', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const roles = ['observer', 'reviewer', 'approver', 'operator'] as const;
    const results: boolean[] = [];

    for (const role of roles) {
      mockFrom.mockReturnValue(profileRow(role));
      const r = await requireRole('approver');
      results.push(!(r instanceof NextResponse));
    }

    // observer=fail, reviewer=fail, approver=pass, operator=pass
    expect(results).toEqual([false, false, true, true]);
  });
});
