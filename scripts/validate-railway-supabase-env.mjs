#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Production env contract validator for Sentinel's Railway + Supabase topology.
 *
 * Supports three runtime-specific env maps (web/engine/agents) and can load values from:
 * - current process.env
 * - an env file via --env-file=<path>
 *
 * Usage examples:
 *   node scripts/validate-railway-supabase-env.mjs --profile=web --production --project-ref=luwyjfwauljwsfsnwiqb
 *   node scripts/validate-railway-supabase-env.mjs --profile=engine --env-file=.env.engine
 *   node scripts/validate-railway-supabase-env.mjs --profile=all --production --project-ref=luwyjfwauljwsfsnwiqb --env-file=.env.audit --require-private-engine
 */

if (isMainModule()) {
  const args = parseArgs(process.argv.slice(2));

  if (args.get('--help') === 'true') {
    printHelp();
    process.exit(0);
  }

  const profile = (args.get('--profile') || 'all').toLowerCase();
  const productionMode = args.get('--production') === 'true';
  const requiredProjectRef = (args.get('--project-ref') || '').trim();
  const requirePrivateEngine = args.get('--require-private-engine') === 'true';
  const envFile = args.get('--env-file') || '';

  const allowedProfiles = new Set(['web', 'engine', 'agents', 'all']);
  if (!allowedProfiles.has(profile)) {
    failFast(`Invalid --profile value: ${profile}. Use one of: web, engine, agents, all.`);
  }

  const env = buildEnv(envFile);
  const results = validateRailwaySupabaseContract(env, {
    profile,
    productionMode,
    requiredProjectRef,
    requirePrivateEngine,
  });

  printSummary(results, { profile, productionMode, envFile });

  if (results.some((result) => !result.ok)) {
    process.exit(1);
  }
}

export function validateRailwaySupabaseContract(env, options) {
  const checks = [];
  const selectedProfile = options.profile;

  if (selectedProfile === 'web' || selectedProfile === 'all') {
    checks.push(...validateWebProfile(env, options));
  }
  if (selectedProfile === 'engine' || selectedProfile === 'all') {
    checks.push(...validateEngineProfile(env, options));
  }
  if (selectedProfile === 'agents' || selectedProfile === 'all') {
    checks.push(...validateAgentsProfile(env, options));
  }

  checks.push(...validateCrossServiceInvariants(env));

  return checks;
}

function validateWebProfile(env, options) {
  const checks = [];

  checks.push(checkNonEmpty('web', env, 'NEXT_PUBLIC_SUPABASE_URL'));
  checks.push(
    checkOneOfNonEmpty('web', env, [
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]),
  );
  checks.push(checkNonEmpty('web', env, 'ENGINE_URL'));
  checks.push(checkNonEmpty('web', env, 'AGENTS_URL'));
  checks.push(checkNonEmpty('web', env, 'ENGINE_API_KEY'));
  checks.push(checkNonEmpty('web', env, 'SUPABASE_SERVICE_ROLE_KEY'));

  const publicKey = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '').trim();
  if (publicKey) {
    checks.push(checkPattern('web', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', /^sb_publishable_[a-z0-9._-]+$/iu, publicKey, 'must start with sb_publishable_'));
  }

  const anonKey = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (anonKey) {
    checks.push(checkLooksJwt('web', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey));
  }

  checks.push(...checkSupabaseUrl('web', env.NEXT_PUBLIC_SUPABASE_URL || '', options.requiredProjectRef));
  checks.push(...checkRailwayPublicUrl('web', 'ENGINE_URL', env.ENGINE_URL || '', options.productionMode));
  checks.push(...checkRailwayPublicUrl('web', 'AGENTS_URL', env.AGENTS_URL || '', options.productionMode));
  checks.push(checkApiKeyStrength('web', 'ENGINE_API_KEY', env.ENGINE_API_KEY || ''));
  checks.push(checkLooksJwt('web', 'SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY || ''));

  return checks;
}

function validateEngineProfile(env, options) {
  const checks = [];

  checks.push(checkNonEmpty('engine', env, 'SUPABASE_URL'));
  checks.push(checkNonEmpty('engine', env, 'SUPABASE_SERVICE_ROLE_KEY'));
  checks.push(checkNonEmpty('engine', env, 'ENGINE_API_KEY'));

  checks.push(...checkSupabaseUrl('engine', env.SUPABASE_URL || '', options.requiredProjectRef));
  checks.push(checkLooksJwt('engine', 'SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY || ''));
  checks.push(checkApiKeyStrength('engine', 'ENGINE_API_KEY', env.ENGINE_API_KEY || ''));

  return checks;
}

function validateAgentsProfile(env, options) {
  const checks = [];

  checks.push(checkNonEmpty('agents', env, 'SUPABASE_URL'));
  checks.push(checkNonEmpty('agents', env, 'SUPABASE_SERVICE_ROLE_KEY'));
  checks.push(checkNonEmpty('agents', env, 'SUPABASE_JWT_SECRET'));
  checks.push(checkNonEmpty('agents', env, 'ENGINE_URL'));

  checks.push(...checkSupabaseUrl('agents', env.SUPABASE_URL || '', options.requiredProjectRef));
  checks.push(checkLooksJwt('agents', 'SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY || ''));
  checks.push(checkSecretStrength('agents', 'SUPABASE_JWT_SECRET', env.SUPABASE_JWT_SECRET || ''));

  if (options.requirePrivateEngine) {
    const engineUrl = env.ENGINE_URL || '';
    const ok = /^http:\/\/[a-z0-9-]+\.railway\.internal:\d+$/iu.test(engineUrl);
    checks.push(
      createCheck(
        'agents',
        ok,
        ok
          ? 'ENGINE_URL is a Railway private-network URL as required.'
          : 'ENGINE_URL must use Railway private networking (http://<service>.railway.internal:<port>).',
      ),
    );
  }

  return checks;
}

function validateCrossServiceInvariants(env) {
  const checks = [];
  const supabaseUrl = env.SUPABASE_URL || '';
  const publicSupabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';

  if (supabaseUrl && publicSupabaseUrl) {
    const ok = normalizeUrlHost(supabaseUrl) === normalizeUrlHost(publicSupabaseUrl);
    checks.push(
      createCheck(
        'cross-service',
        ok,
        ok
          ? 'SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL point to the same project host.'
          : 'SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must target the same Supabase project host.',
      ),
    );
  }

  return checks;
}

function buildEnv(envFile) {
  if (!envFile) {
    return { ...process.env };
  }

  const absolutePath = path.isAbsolute(envFile)
    ? envFile
    : path.resolve(process.cwd(), envFile);
  const parsed = parseEnvFile(readFileSync(absolutePath, 'utf8'));

  return {
    ...process.env,
    ...parsed,
  };
}

function parseEnvFile(content) {
  const env = {};
  const lines = content.split(/\r?\n/u);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function parseArgs(argv) {
  return new Map(
    argv.map((arg) => {
      const [key, value = 'true'] = arg.split('=');
      return [key, value];
    }),
  );
}

function checkNonEmpty(scope, env, envName) {
  const value = env[envName] || '';
  return createCheck(scope, Boolean(value.trim()), `${envName} is ${value.trim() ? 'set' : 'missing'}.`);
}

function checkOneOfNonEmpty(scope, env, names) {
  const present = names.find((name) => (env[name] || '').trim().length > 0);
  const ok = Boolean(present);

  return createCheck(
    scope,
    ok,
    ok
      ? `${present} is set (acceptable Supabase browser key).`
      : `One of ${names.join(' or ')} must be set.`,
  );
}

function checkSupabaseUrl(scope, value, requiredProjectRef) {
  const checks = [];
  const validShape = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/iu.test(value);

  checks.push(
    createCheck(
      scope,
      validShape,
      validShape
        ? 'Supabase URL format is valid.'
        : 'Supabase URL must match https://<project-ref>.supabase.co',
    ),
  );

  if (requiredProjectRef) {
    const expectedHost = `${requiredProjectRef}.supabase.co`;
    const ok = normalizeUrlHost(value) === expectedHost;

    checks.push(
      createCheck(
        scope,
        ok,
        ok
          ? `Supabase URL matches required project ref (${requiredProjectRef}).`
          : `Supabase URL does not match required project ref (${requiredProjectRef}).`,
      ),
    );
  }

  return checks;
}

function checkRailwayPublicUrl(scope, envName, value, productionMode) {
  const checks = [];
  const looksRailway = /^https:\/\/[a-z0-9-]+\.up\.railway\.app\/?$/iu.test(value);

  if (productionMode) {
    checks.push(
      createCheck(
        scope,
        looksRailway,
        looksRailway
          ? `${envName} uses Railway public HTTPS URL.`
          : `${envName} must use https://<service>.up.railway.app in production.`,
      ),
    );

    const localhost = /localhost|127\.0\.0\.1/iu.test(value);
    checks.push(
      createCheck(
        scope,
        !localhost,
        localhost
          ? `${envName} must not point to localhost in production.`
          : `${envName} is not localhost.`,
      ),
    );
  } else {
    checks.push(
      createCheck(
        scope,
        true,
        `${envName} Railway URL shape check skipped (not in --production mode).`,
      ),
    );
  }

  return checks;
}

function checkPattern(scope, envName, pattern, value, expectationText) {
  const ok = pattern.test(value);
  return createCheck(
    scope,
    ok,
    ok ? `${envName} format check passed.` : `${envName} ${expectationText}.`,
  );
}

function checkLooksJwt(scope, envName, value) {
  const ok = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/u.test(value);
  return createCheck(
    scope,
    ok,
    ok
      ? `${envName} appears to be JWT-shaped.`
      : `${envName} should be JWT-shaped (<header>.<payload>.<signature>).`,
  );
}

function checkApiKeyStrength(scope, envName, value) {
  const ok = value.trim().length >= 24;
  return createCheck(
    scope,
    ok,
    ok ? `${envName} length check passed.` : `${envName} should be at least 24 characters.`,
  );
}

function checkSecretStrength(scope, envName, value) {
  const ok = value.trim().length >= 32;
  return createCheck(
    scope,
    ok,
    ok ? `${envName} length check passed.` : `${envName} should be at least 32 characters.`,
  );
}

function createCheck(name, ok, message) {
  return { name, ok, message };
}

function normalizeUrlHost(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

function printSummary(results, context) {
  const width = results.reduce((max, item) => Math.max(max, item.name.length), 5);
  console.log('\nRailway + Supabase env validation\n');
  console.log(
    `Profile=${context.profile} | Production=${context.productionMode ? 'yes' : 'no'}${context.envFile ? ` | EnvFile=${context.envFile}` : ''}`,
  );
  console.log('');

  for (const result of results) {
    const status = result.ok ? 'PASS' : 'FAIL';
    console.log(`${status.padEnd(4)}  ${result.name.padEnd(width)}  ${result.message}`);
  }

  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
}

function printHelp() {
  console.log(`
Usage:
  node scripts/validate-railway-supabase-env.mjs [options]

Options:
  --profile=web|engine|agents|all   Which runtime contract to validate (default: all)
  --production                       Enable production-only URL restrictions
  --project-ref=<ref>               Require Supabase URL host to match <ref>.supabase.co
  --require-private-engine          Require agents ENGINE_URL to be Railway internal URL
  --env-file=<path>                 Load env vars from an env file and merge with process.env
  --help                            Show this help
`);
}

function failFast(message) {
  console.error(message);
  process.exit(2);
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }
  return path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
}
