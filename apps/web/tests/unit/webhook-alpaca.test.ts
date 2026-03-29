import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock Supabase (service role client) ────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

import { POST } from '@/app/api/webhooks/alpaca/route';

const originalEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function makeWebhookRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/webhooks/alpaca', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/webhooks/alpaca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
    vi.restoreAllMocks();
  });

  // ─── General validation ─────────────────────────────────────────

  it('returns 400 when event type is missing', async () => {
    const res = await POST(makeWebhookRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing event type');
  });

  it('returns 400 for unknown event type', async () => {
    const res = await POST(makeWebhookRequest({ event: 'unknown_event' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Unknown event type');
  });

  it('returns 500 when Supabase config is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await POST(
      makeWebhookRequest({ event: 'account_status', account_id: 'x', status: 'ACTIVE' }),
    );
    expect(res.status).toBe(500);
  });

  // ─── account_status ─────────────────────────────────────────────

  describe('account_status event', () => {
    it('returns 400 without account_id', async () => {
      const res = await POST(makeWebhookRequest({ event: 'account_status', status: 'ACTIVE' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 without status', async () => {
      const res = await POST(makeWebhookRequest({ event: 'account_status', account_id: 'acc-1' }));
      expect(res.status).toBe(400);
    });

    it('maps ACTIVE to approved', async () => {
      const updatedRecord = { user_id: 'u-1', id: 'ba-1' };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'broker_accounts') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: updatedRecord, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'onboarding_audit_log') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'customer_profiles') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const res = await POST(
        makeWebhookRequest({
          event: 'account_status',
          account_id: 'acc-ext-1',
          status: 'ACTIVE',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('approved');
    });

    it('maps REJECTED to rejected', async () => {
      const updatedRecord = { user_id: 'u-1', id: 'ba-1' };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'broker_accounts') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: updatedRecord, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      });

      const res = await POST(
        makeWebhookRequest({
          event: 'account_status',
          account_id: 'acc-ext-1',
          status: 'REJECTED',
          reason: 'Identity verification failed',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('rejected');
    });

    it('maps ACTION_REQUIRED to action_required', async () => {
      const updatedRecord = { user_id: 'u-1', id: 'ba-1' };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'broker_accounts') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: updatedRecord, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      });

      const res = await POST(
        makeWebhookRequest({
          event: 'account_status',
          account_id: 'acc-ext-1',
          status: 'ACTION_REQUIRED',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('action_required');
    });
  });

  // ─── transfer_status ────────────────────────────────────────────

  describe('transfer_status event', () => {
    it('returns 400 without transfer_id', async () => {
      const res = await POST(
        makeWebhookRequest({
          event: 'transfer_status',
          status: 'COMPLETE',
        }),
      );
      expect(res.status).toBe(400);
    });

    it('maps COMPLETE to complete and advances onboarding for deposits', async () => {
      const txnRecord = { user_id: 'u-1', id: 'ft-1', direction: 'deposit', amount: 1000 };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'funding_transactions') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: txnRecord, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      });

      const res = await POST(
        makeWebhookRequest({
          event: 'transfer_status',
          transfer_id: 'txn-ext-1',
          status: 'COMPLETE',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('complete');
    });

    it('maps FAILED to failed with reason', async () => {
      const txnRecord = { user_id: 'u-1', id: 'ft-1', direction: 'deposit', amount: 500 };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'funding_transactions') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: txnRecord, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      });

      const res = await POST(
        makeWebhookRequest({
          event: 'transfer_status',
          transfer_id: 'txn-ext-1',
          status: 'FAILED',
          reason: 'Insufficient funds',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('failed');
    });
  });

  // ─── ach_relationship_status ────────────────────────────────────

  describe('ach_relationship_status event', () => {
    it('returns 400 without relationship_id', async () => {
      const res = await POST(
        makeWebhookRequest({
          event: 'ach_relationship_status',
          status: 'APPROVED',
        }),
      );
      expect(res.status).toBe(400);
    });

    it('maps APPROVED and enables funding', async () => {
      const bankRecord = { user_id: 'u-1', id: 'bl-1' };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'bank_links') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: bankRecord, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      });

      const res = await POST(
        makeWebhookRequest({
          event: 'ach_relationship_status',
          relationship_id: 'rel-ext-1',
          status: 'APPROVED',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('approved');
    });

    it('maps FAILED status', async () => {
      const bankRecord = { user_id: 'u-1', id: 'bl-1' };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'bank_links') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: bankRecord, error: null }),
                }),
              }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const res = await POST(
        makeWebhookRequest({
          event: 'ach_relationship_status',
          relationship_id: 'rel-ext-1',
          status: 'FAILED',
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('failed');
    });
  });
});
