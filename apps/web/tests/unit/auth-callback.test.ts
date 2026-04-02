import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/auth/callback/route';

/* ── Mocks ─────────────────────────────────────────────────── */

const mockExchangeCode = vi.fn();
const mockVerifyOtp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCode,
      verifyOtp: mockVerifyOtp,
    },
  })),
}));

vi.mock('@/lib/auth/url', () => ({
  sanitizeRedirectPath: (path: string | null) => path || '/',
}));

/* ── Helpers ───────────────────────────────────────────────── */

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/auth/callback');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

/* ── Tests ─────────────────────────────────────────────────── */

describe('Auth callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeCode.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({ error: null });
  });

  describe('PKCE code exchange', () => {
    it('redirects to / on successful code exchange', async () => {
      const response = await GET(makeRequest({ code: 'valid-code' }));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('location')!).pathname).toBe('/');
      expect(mockExchangeCode).toHaveBeenCalledWith('valid-code');
    });

    it('respects next param on successful exchange', async () => {
      const response = await GET(makeRequest({ code: 'valid-code', next: '/settings' }));
      expect(new URL(response.headers.get('location')!).pathname).toBe('/settings');
    });

    it('redirects to error page on code exchange failure', async () => {
      mockExchangeCode.mockResolvedValue({
        error: { message: 'Invalid code', status: 400 },
      });
      const response = await GET(makeRequest({ code: 'bad-code' }));
      const url = new URL(response.headers.get('location')!);
      expect(url.pathname).toBe('/auth/error');
      expect(url.searchParams.get('reason')).toBe('code_exchange_failed');
    });

    it('handles thrown exception during code exchange', async () => {
      mockExchangeCode.mockRejectedValue(new Error('Network error'));
      const response = await GET(makeRequest({ code: 'bad-code' }));
      const url = new URL(response.headers.get('location')!);
      expect(url.searchParams.get('reason')).toBe('code_exchange_failed');
    });
  });

  describe('Token hash verification', () => {
    it('redirects to / on successful email verification', async () => {
      const response = await GET(makeRequest({ token_hash: 'hash123', type: 'email' }));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('location')!).pathname).toBe('/');
      expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'hash123', type: 'email' });
    });

    it('redirects to /reset-password for recovery tokens', async () => {
      const response = await GET(makeRequest({ token_hash: 'hash123', type: 'recovery' }));
      expect(new URL(response.headers.get('location')!).pathname).toBe('/reset-password');
    });

    it('redirects to error page on verification failure', async () => {
      mockVerifyOtp.mockResolvedValue({
        error: { message: 'Token expired', status: 400 },
      });
      const response = await GET(makeRequest({ token_hash: 'hash123', type: 'email' }));
      const url = new URL(response.headers.get('location')!);
      expect(url.searchParams.get('reason')).toBe('token_verification_failed');
    });

    it('rejects invalid OTP type', async () => {
      const response = await GET(makeRequest({ token_hash: 'hash123', type: 'invalid' }));
      const url = new URL(response.headers.get('location')!);
      expect(url.searchParams.get('reason')).toBe('missing_params');
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it('handles email_change type', async () => {
      const response = await GET(makeRequest({ token_hash: 'hash123', type: 'email_change' }));
      expect(response.status).toBe(307);
      expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'hash123', type: 'email_change' });
    });
  });

  describe('Missing params', () => {
    it('redirects to error page when no params given', async () => {
      const response = await GET(makeRequest({}));
      const url = new URL(response.headers.get('location')!);
      expect(url.searchParams.get('reason')).toBe('missing_params');
    });

    it('redirects to error page when only token_hash but no type', async () => {
      const response = await GET(makeRequest({ token_hash: 'hash123' }));
      const url = new URL(response.headers.get('location')!);
      expect(url.searchParams.get('reason')).toBe('missing_params');
    });
  });
});
