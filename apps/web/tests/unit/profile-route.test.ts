import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock Supabase ──────────────────────────────────────────────────

const mockUser = { id: 'user-456', email: 'test@example.com' };
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

import { GET, PUT } from '@/app/api/onboarding/profile/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/onboarding/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── GET tests ──────────────────────────────────────────────────

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns existing profile', async () => {
      const mockProfile = {
        user_id: mockUser.id,
        legal_name: 'John Doe',
        onboarding_step: 'app_account_created',
      };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.legal_name).toBe('John Doe');
    });

    it('auto-creates profile if none exists', async () => {
      const createdProfile = {
        user_id: mockUser.id,
        onboarding_step: 'app_account_created',
      };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdProfile, error: null }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(200);
    });
  });

  // ─── PUT tests ──────────────────────────────────────────────────

  describe('PUT', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const req = makeRequest({ legal_name: 'John Doe' });
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });

    it('rejects empty update body', async () => {
      const req = makeRequest({});
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('No valid fields');
    });

    it('rejects non-string field values', async () => {
      const req = makeRequest({ legal_name: 123 });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('must be a string or null');
    });

    it('rejects unknown fields silently (no update)', async () => {
      const req = makeRequest({ unknown_field: 'value' });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('No valid fields');
    });

    it('accepts valid profile fields', async () => {
      const updatedProfile = {
        user_id: mockUser.id,
        legal_name: 'Jane Doe',
        city: 'New York',
        onboarding_step: 'app_account_created',
      };

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'customer_profiles') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedProfile, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'onboarding_audit_log') {
          return { insert: insertMock };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const req = makeRequest({ legal_name: 'Jane Doe', city: 'New York' });
      const res = await PUT(req);
      expect(res.status).toBe(200);

      // Verify audit log was called
      expect(insertMock).toHaveBeenCalled();
    });

    it('allows null values for optional fields', async () => {
      const updatedProfile = {
        user_id: mockUser.id,
        legal_name: null,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'customer_profiles') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedProfile, error: null }),
                }),
              }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const req = makeRequest({ legal_name: null });
      const res = await PUT(req);
      expect(res.status).toBe(200);
    });

    it('rejects invalid onboarding_step value', async () => {
      // Need to setup profile fetch for step validation
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { onboarding_step: 'app_account_created' },
              error: null,
            }),
          }),
        }),
      });

      const req = makeRequest({ onboarding_step: 'nonexistent_step' });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid onboarding step');
    });

    it('rejects invalid state transitions', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { onboarding_step: 'app_account_created' },
              error: null,
            }),
          }),
        }),
      });

      const req = makeRequest({ onboarding_step: 'live_active' });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Cannot transition');
    });
  });
});
