/**
 * Centralized environment variable validation for the web app.
 * Import from this module instead of accessing process.env directly.
 */

/* ------------------------------------------------------------------ */
/*  Supabase key resolution                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns the Supabase publishable key, preferring the modern
 * `sb_publishable_*` format over the legacy JWT anon key.
 */
export function getSupabaseKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined
  );
}

/* ------------------------------------------------------------------ */
/*  Server-side env (only available in API routes / server components) */
/* ------------------------------------------------------------------ */

export function getServerEnv() {
  const supabaseKey = getSupabaseKey();
  if (!supabaseKey) {
    throw new Error(
      'Missing Supabase key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return {
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseKey,
    supabaseServiceRoleKey: optionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
    engineUrl: optionalEnv('ENGINE_URL'),
    engineApiKey: optionalEnv('ENGINE_API_KEY'),
    agentsUrl: optionalEnv('AGENTS_URL'),
    agentsApiKey: optionalEnv('AGENTS_API_KEY'),
    nodeEnv: optionalEnv('NODE_ENV') ?? 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isVercel: !!process.env.VERCEL,
  };
}

/* ------------------------------------------------------------------ */
/*  Client-side env (NEXT_PUBLIC_ prefix only)                        */
/* ------------------------------------------------------------------ */

export function getClientEnv() {
  const supabaseKey = getSupabaseKey();
  if (!supabaseKey) {
    throw new Error(
      'Missing Supabase key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return {
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseKey,
    siteUrl: optionalEnv('NEXT_PUBLIC_SITE_URL'),
  };
}

/* ------------------------------------------------------------------ */
/*  Startup validation — call from instrumentation.ts                 */
/* ------------------------------------------------------------------ */

const REQUIRED_VARS = ['NEXT_PUBLIC_SUPABASE_URL'] as const;

const RECOMMENDED_VARS = ['ENGINE_URL', 'ENGINE_API_KEY', 'AGENTS_URL'] as const;

export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // At least one Supabase key must be set
  if (!getSupabaseKey()) {
    missing.push(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    );
  }

  for (const key of RECOMMENDED_VARS) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(
      `[env] Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values.',
    );
  }

  if (warnings.length > 0) {
    console.warn(
      `[env] Missing recommended environment variables: ${warnings.join(', ')}. ` +
        'Some features will be degraded.',
    );
  }

  return { valid: missing.length === 0, missing, warnings };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}
