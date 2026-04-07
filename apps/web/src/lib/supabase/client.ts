import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseKey } from '@/lib/env';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
        '(or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY). See .env.example for guidance.',
    );
  }

  return createBrowserClient(url, key);
}
