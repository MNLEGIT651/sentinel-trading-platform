// apps/agents/tests/supabase-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSupabaseClient, resetSupabaseClient } from '../src/supabase-client.js';

describe('getSupabaseClient', () => {
  beforeEach(() => {
    resetSupabaseClient();
  });

  it('throws when SUPABASE_URL is missing', () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    expect(() => getSupabaseClient()).toThrow('SUPABASE_URL');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => getSupabaseClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('returns a client when both vars are set', () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const client = getSupabaseClient();
    expect(client).toBeDefined();
  });
});
