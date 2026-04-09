import test from 'node:test';
import assert from 'node:assert/strict';

import { checkContract, parseDotenv } from './check-env-contract.mjs';

test('parseDotenv strips quotes and inline comments', () => {
  const env = parseDotenv(`
# hi
FOO=bar
BAZ="zap" # tail
`);
  assert.equal(env.FOO, 'bar');
  assert.equal(env.BAZ, 'zap');
});

test('checkContract passes for a full local stack shape', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'sb_publishable_x',
    SUPABASE_URL: 'https://abc.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    SUPABASE_JWT_SECRET: 'jwt'.repeat(12),
    ANTHROPIC_API_KEY: 'sk-ant',
    ENGINE_URL: 'http://localhost:8000',
    ENGINE_API_KEY: 'engine-secret',
    AGENTS_URL: 'http://localhost:3001',
  };
  const r = checkContract(env);
  assert.equal(r.ok, true);
  assert.equal(r.webReqMiss.length, 0);
  assert.equal(r.engMiss.length, 0);
  assert.equal(r.agMiss.length, 0);
});

test('checkContract fails when agents JWT missing', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_URL: 'https://abc.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    ANTHROPIC_API_KEY: 'sk-ant',
    ENGINE_URL: 'http://localhost:8000',
    ENGINE_API_KEY: 'engine-secret',
  };
  const r = checkContract(env);
  assert.equal(r.ok, false);
  assert.ok(r.agMiss.some((line) => line.includes('SUPABASE_JWT_SECRET')));
});

test('checkContract rejects whitespace-only Supabase client keys', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '   ',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: '\t',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ' ',
    SUPABASE_URL: 'https://abc.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    SUPABASE_JWT_SECRET: 'x'.repeat(32),
    ANTHROPIC_API_KEY: 'sk-ant',
    ENGINE_URL: 'http://localhost:8000',
    ENGINE_API_KEY: 'engine-secret',
  };
  const r = checkContract(env);
  assert.equal(r.ok, false);
  assert.ok(r.webReqMiss.some((line) => line.includes('client key')));
});

test('checkContract warns on Supabase host mismatch', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://aaa.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_URL: 'https://bbb.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    SUPABASE_JWT_SECRET: 'x'.repeat(32),
    ANTHROPIC_API_KEY: 'sk-ant',
    ENGINE_URL: 'http://localhost:8000',
    ENGINE_API_KEY: 'engine-secret',
  };
  const r = checkContract(env);
  assert.equal(r.warnings.length, 1);
});
