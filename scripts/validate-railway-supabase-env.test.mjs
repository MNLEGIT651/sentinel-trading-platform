import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRailwaySupabaseContract } from './validate-railway-supabase-env.mjs';

test('passes full contract for agents profile with private engine requirement', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://luwyjfwauljwsfsnwiqb.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'sb_publishable_abc123',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'aaa.bbb.ccc',
    SUPABASE_URL: 'https://luwyjfwauljwsfsnwiqb.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'aaa.bbb.ccc',
    SUPABASE_JWT_SECRET: 'x'.repeat(32),
    ENGINE_URL: 'http://sentinel-engine-trading.railway.internal:8000',
    AGENTS_URL: 'https://sentinel-agents.up.railway.app',
    ENGINE_API_KEY: 'x'.repeat(24),
  };

  const results = validateRailwaySupabaseContract(env, {
    profile: 'agents',
    productionMode: true,
    requiredProjectRef: 'luwyjfwauljwsfsnwiqb',
    requirePrivateEngine: true,
  });

  const failed = results.filter((result) => !result.ok);
  assert.equal(failed.length, 0, `Expected no failed checks, got: ${JSON.stringify(failed, null, 2)}`);
});

test('fails when Supabase project-ref does not match', () => {
  const env = {
    SUPABASE_URL: 'https://otherproject.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'aaa.bbb.ccc',
    ENGINE_API_KEY: 'x'.repeat(24),
  };

  const results = validateRailwaySupabaseContract(env, {
    profile: 'engine',
    productionMode: false,
    requiredProjectRef: 'luwyjfwauljwsfsnwiqb',
    requirePrivateEngine: false,
  });

  assert.ok(
    results.some(
      (result) =>
        !result.ok &&
        result.message.includes('does not match required project ref'),
    ),
  );
});

test('fails short secret and weak API key', () => {
  const env = {
    SUPABASE_URL: 'https://luwyjfwauljwsfsnwiqb.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'aaa.bbb.ccc',
    SUPABASE_JWT_SECRET: 'short',
    ENGINE_URL: 'http://sentinel-engine-trading.railway.internal:8000',
    ENGINE_API_KEY: 'too-short',
  };

  const results = validateRailwaySupabaseContract(env, {
    profile: 'agents',
    productionMode: true,
    requiredProjectRef: 'luwyjfwauljwsfsnwiqb',
    requirePrivateEngine: true,
  });

  assert.ok(results.some((result) => !result.ok && result.message.includes('at least 32 characters')));
});

test('flags web localhost URLs in production mode', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://luwyjfwauljwsfsnwiqb.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'sb_publishable_abc123',
    ENGINE_URL: 'http://localhost:8000',
    AGENTS_URL: 'http://127.0.0.1:3001',
    ENGINE_API_KEY: 'x'.repeat(24),
    SUPABASE_SERVICE_ROLE_KEY: 'aaa.bbb.ccc',
  };

  const results = validateRailwaySupabaseContract(env, {
    profile: 'web',
    productionMode: true,
    requiredProjectRef: 'luwyjfwauljwsfsnwiqb',
    requirePrivateEngine: false,
  });

  assert.ok(results.some((result) => !result.ok && result.message.includes('must not point to localhost')));
  assert.ok(results.some((result) => !result.ok && result.message.includes('must use https://<service>.up.railway.app')));
});
