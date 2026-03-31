import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// ─── Shared mocks ────────────────────────────────────────────────────

const mockUser = { id: 'user-123', email: 'test@example.com' } as unknown as User;
const mockFrom = vi.fn();

const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
  from: mockFrom,
} as unknown as SupabaseClient;

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ user: mockUser, supabase: mockSupabase })),
}));

vi.mock('@/lib/server/rate-limiter', () => ({
  checkApiRateLimit: vi.fn(() => null),
}));

vi.mock('@/lib/api-error', () => ({
  safeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

import { requireAuth } from '@/lib/auth/require-auth';
import { GET, POST } from '@/app/api/onboarding/consent/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/onboarding/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('/api/onboarding/consent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ user: mockUser, supabase: mockSupabase });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── GET tests ──────────────────────────────────────────────────

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      );
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns consent records for authenticated user', async () => {
      const mockData = [{ id: 'c1', document_type: 'terms_of_service', document_version: '1.0' }];
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].document_type).toBe('terms_of_service');
    });

    it('returns 500 on database error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(500);
    });
  });

  // ─── POST tests ─────────────────────────────────────────────────

  describe('POST', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(
        NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      );
      const req = makeRequest({ document_type: 'terms_of_service', document_version: '1.0' });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('rejects invalid document_type', async () => {
      const req = makeRequest({ document_type: 'invalid_type', document_version: '1.0' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('validation_error');
    });

    it('rejects missing document_version', async () => {
      const req = makeRequest({ document_type: 'terms_of_service' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('validation_error');
    });

    it('rejects empty document_version', async () => {
      const req = makeRequest({ document_type: 'terms_of_service', document_version: '  ' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('validation_error');
    });

    it('rejects non-object body', async () => {
      const req = new Request('http://localhost/api/onboarding/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '"just a string"',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('accepts all valid document types', async () => {
      const validTypes = [
        'terms_of_service',
        'privacy_policy',
        'electronic_delivery',
        'customer_agreement',
        'data_sharing',
        'broker_disclosures',
        'margin_disclosure',
        'risk_disclosure',
      ];

      for (const type of validTypes) {
        vi.clearAllMocks();
        vi.mocked(requireAuth).mockResolvedValue({ user: mockUser, supabase: mockSupabase });

        const mockConsentData = {
          id: 'c-new',
          user_id: mockUser.id,
          document_type: type,
          document_version: '1.0',
        };

        mockFrom.mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockConsentData, error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        });

        const req = makeRequest({ document_type: type, document_version: '1.0' });
        const res = await POST(req);
        // All valid types should pass validation (either 201 or supabase-dependent)
        expect(res.status).not.toBe(400);
      }
    });

    it('creates consent and audit log on success', async () => {
      const mockConsentData = {
        id: 'c-new',
        user_id: mockUser.id,
        document_type: 'terms_of_service',
        document_version: '1.0',
        accepted_at: new Date().toISOString(),
      };

      // Track calls to from()
      const fromCalls: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        fromCalls.push(table);
        if (table === 'consents') {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockConsentData, error: null }),
              }),
            }),
          };
        }
        if (table === 'onboarding_audit_log') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const req = makeRequest({ document_type: 'terms_of_service', document_version: '1.0' });
      const res = await POST(req);
      expect(res.status).toBe(201);

      // Verify both consents and audit_log were called
      expect(fromCalls).toContain('consents');
      expect(fromCalls).toContain('onboarding_audit_log');
    });

    it('captures IP and user-agent from headers', async () => {
      let upsertArgs: Record<string, unknown> | undefined;

      mockFrom.mockImplementation((table: string) => {
        if (table === 'consents') {
          return {
            upsert: vi.fn().mockImplementation((data: unknown) => {
              upsertArgs = data as Record<string, unknown>;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'c-1', ...upsertArgs },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const req = makeRequest(
        { document_type: 'privacy_policy', document_version: '1.0' },
        {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
          'user-agent': 'TestBrowser/1.0',
        },
      );
      const res = await POST(req);
      expect(res.status).toBe(201);

      expect(upsertArgs).toBeDefined();
      expect(upsertArgs!.ip_address).toBe('192.168.1.1');
      expect(upsertArgs!.user_agent).toBe('TestBrowser/1.0');
    });
  });
});
