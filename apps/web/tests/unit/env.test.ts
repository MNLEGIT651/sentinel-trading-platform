import { afterEach, describe, expect, it } from 'vitest';
import { getSupabaseKey } from '@/lib/env';

const originalEnv = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function restoreEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    originalEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
    originalEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

afterEach(() => {
  restoreEnv();
});

describe('getSupabaseKey', () => {
  it('prefers standard NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_standard';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'sb_publishable_default';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon_legacy';

    expect(getSupabaseKey()).toBe('sb_publishable_standard');
  });

  it('falls back to legacy publishable default key', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'sb_publishable_default';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon_legacy';

    expect(getSupabaseKey()).toBe('sb_publishable_default');
  });

  it('falls back to anon key when publishable keys are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon_legacy';

    expect(getSupabaseKey()).toBe('anon_legacy');
  });
});
