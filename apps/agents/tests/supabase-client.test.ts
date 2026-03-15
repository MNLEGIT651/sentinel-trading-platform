// apps/agents/tests/supabase-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('getSupabaseClient', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws when SUPABASE_URL is missing', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    const { getSupabaseClient } = await import('../src/supabase-client.js');
    expect(() => getSupabaseClient()).toThrow('SUPABASE_URL');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const { getSupabaseClient } = await import('../src/supabase-client.js');
    expect(() => getSupabaseClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('returns a client when both vars are set', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { getSupabaseClient } = await import('../src/supabase-client.js');
    const client = getSupabaseClient();
    expect(client).toBeDefined();
  });
});
