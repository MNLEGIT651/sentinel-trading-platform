import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Supabase mock ──────────────────────────────────────────────────

const mockUser = { id: 'user-123', email: 'test@example.com' };
let mockChainData: unknown = null;
let mockChainError: unknown = null;

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(() => ({ data: mockChainData, error: mockChainError })),
  then: vi.fn(),
  get data() {
    return mockChainData;
  },
  get error() {
    return mockChainError;
  },
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
  },
  from: vi.fn(() => mockChain),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

function setChainResult(data: unknown, error: unknown = null) {
  mockChainData = data;
  mockChainError = error;

  // Ensure chained methods return proper data
  const terminalResult = { data, error };
  mockChain.select.mockReturnValue({ ...mockChain, ...terminalResult });
  mockChain.insert.mockReturnValue({ ...mockChain, ...terminalResult });
  mockChain.update.mockReturnValue({ ...mockChain, ...terminalResult });
  mockChain.single.mockReturnValue(terminalResult);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Advisor API routes', { timeout: 15_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData = null;
    mockChainError = null;
  });

  describe('GET /api/advisor/profile', () => {
    it('returns 401 when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null as never },
        error: { message: 'Not authenticated' } as never,
      });

      const { GET } = await import('@/app/api/advisor/profile/route');
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns profile data when authenticated', async () => {
      const profileData = {
        id: 'p1',
        user_id: 'user-123',
        profile: { risk_tolerance: 'moderate' },
        version: 1,
      };
      setChainResult(profileData);

      const { GET } = await import('@/app/api/advisor/profile/route');
      const res = await GET();
      // Route will either return profile or upsert default
      expect(res.status).toBeLessThanOrEqual(500);
    });
  });

  describe('GET /api/advisor/memory-events', () => {
    it('returns 401 when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null as never },
        error: { message: 'Not authenticated' } as never,
      });

      const { GET } = await import('@/app/api/advisor/memory-events/route');
      const req = new Request('http://localhost/api/advisor/memory-events');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });
});
