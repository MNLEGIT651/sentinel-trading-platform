import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockCreateServerClient, mockCookies, mockGetSupabaseKey } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockCookies: vi.fn(),
  mockGetSupabaseKey: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/env', () => ({
  getSupabaseKey: mockGetSupabaseKey,
}));

import { updateSession } from '@/lib/supabase/server';

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    mockGetSupabaseKey.mockReturnValue('test-publishable-key');
    mockCookies.mockResolvedValue({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    });
  });

  it('returns a null user when Supabase returns no claims payload', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    });

    const request = new NextRequest('https://example.com/dashboard');
    const result = await updateSession(request);

    expect(result.user).toBeNull();
    expect(result.supabaseResponse).toBeInstanceOf(NextResponse);
  });

  it('hydrates the user id from the JWT claims subject when present', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: 'user-123' } },
          error: null,
        }),
      },
    });

    const request = new NextRequest('https://example.com/dashboard');
    const result = await updateSession(request);

    expect(result.user).toEqual({ id: 'user-123' });
    expect(result.supabaseResponse).toBeInstanceOf(NextResponse);
  });
});
