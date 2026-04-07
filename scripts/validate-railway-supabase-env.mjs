#!/usr/bin/env node

/**
 * Production env contract validator for Sentinel's Railway + Supabase topology.
 *
 * Usage:
 *   node scripts/validate-railway-supabase-env.mjs --profile=web --production --project-ref=luwyjfwauljwsfsnwiqb
 *   node scripts/validate-railway-supabase-env.mjs --profile=engine --project-ref=luwyjfwauljwsfsnwiqb
 *   node scripts/validate-railway-supabase-env.mjs --profile=agents --production --require-private-engine
 */

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.split('=');
    return [key, value];
  }),
);

const profile = (args.get('--profile') || 'all').toLowerCase();
const productionMode = args.get('--production') === 'true';
const requiredProjectRef = args.get('--project-ref') || '';
const requirePrivateEngine = args.get('--require-private-engine') === 'true';

const allowedProfiles = new Set(['web', 'engine', 'agents', 'all']);
if (!allowedProfiles.has(profile)) {
  failFast(`Invalid --profile value: ${profile}. Use one of: web, engine, agents, all.`);
}

/** @type {{name: string, ok: boolean, message: string}[]} */
const results = [];

if (profile === 'web' || profile === 'all') {
  checkWeb();
}
if (profile === 'engine' || profile === 'all') {
  checkEngine();
}
if (profile === 'agents' || profile === 'all') {
  checkAgents();
}

checkCrossServiceInvariants();

printSummary(results);
if (results.some((result) => !result.ok)) {
  process.exit(1);
}

function checkWeb() {
  checkNonEmpty('web', 'NEXT_PUBLIC_SUPABASE_URL');
  checkOneOfNonEmpty('web', [
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]);
  checkNonEmpty('web', 'ENGINE_URL');
  checkNonEmpty('web', 'AGENTS_URL');
  checkNonEmpty('web', 'ENGINE_API_KEY');
  checkNonEmpty('web', 'SUPABASE_SERVICE_ROLE_KEY');

  checkSupabaseUrl('web', process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  checkRailwayPublicUrl('web', 'ENGINE_URL');
  checkRailwayPublicUrl('web', 'AGENTS_URL');
}

function checkEngine() {
  checkNonEmpty('engine', 'SUPABASE_URL');
  checkNonEmpty('engine', 'SUPABASE_SERVICE_ROLE_KEY');
  checkNonEmpty('engine', 'ENGINE_API_KEY');

  checkSupabaseUrl('engine', process.env.SUPABASE_URL || '');
}

function checkAgents() {
  checkNonEmpty('agents', 'SUPABASE_URL');
  checkNonEmpty('agents', 'SUPABASE_SERVICE_ROLE_KEY');
  checkNonEmpty('agents', 'SUPABASE_JWT_SECRET');
  checkNonEmpty('agents', 'ENGINE_URL');

  checkSupabaseUrl('agents', process.env.SUPABASE_URL || '');

  if (requirePrivateEngine) {
    const engineUrl = process.env.ENGINE_URL || '';
    const ok = /^http:\/\/[a-z0-9-]+\.railway\.internal:\d+$/iu.test(engineUrl);
    pushResult(
      'agents',
      ok,
      ok
        ? 'ENGINE_URL is a Railway private-network URL as required.'
        : 'ENGINE_URL must use Railway private networking (http://<service>.railway.internal:<port>).',
    );
  }
}

function checkCrossServiceInvariants() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  if (supabaseUrl && publicSupabaseUrl) {
    const ok = normalizeUrlHost(supabaseUrl) === normalizeUrlHost(publicSupabaseUrl);
    pushResult(
      'cross-service',
      ok,
      ok
        ? 'SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL point to the same project host.'
        : 'SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must target the same Supabase project host.',
    );
  }
}

function checkNonEmpty(scope, envName) {
  const value = process.env[envName] || '';
  pushResult(scope, Boolean(value.trim()), `${envName} is ${value.trim() ? 'set' : 'missing'}.`);
}

function checkOneOfNonEmpty(scope, names) {
  const present = names.find((name) => (process.env[name] || '').trim().length > 0);
  const ok = Boolean(present);
  pushResult(
    scope,
    ok,
    ok
      ? `${present} is set (acceptable Supabase browser key).`
      : `One of ${names.join(' or ')} must be set.`,
  );
}

function checkSupabaseUrl(scope, value) {
  const validShape = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/iu.test(value);
  pushResult(
    scope,
    validShape,
    validShape
      ? 'Supabase URL format is valid.'
      : 'Supabase URL must match https://<project-ref>.supabase.co',
  );

  if (requiredProjectRef) {
    const expectedPrefix = `https://${requiredProjectRef}.supabase.co`;
    const ok = value.startsWith(expectedPrefix);
    pushResult(
      scope,
      ok,
      ok
        ? `Supabase URL matches required project ref (${requiredProjectRef}).`
        : `Supabase URL does not match required project ref (${requiredProjectRef}).`,
    );
  }
}

function checkRailwayPublicUrl(scope, envName) {
  const value = process.env[envName] || '';
  const looksRailway = /^https:\/\/[a-z0-9-]+\.up\.railway\.app\/?$/iu.test(value);
  if (productionMode) {
    pushResult(
      scope,
      looksRailway,
      looksRailway
        ? `${envName} uses Railway public HTTPS URL.`
        : `${envName} must use https://<service>.up.railway.app in production.`,
    );
  } else {
    pushResult(scope, true, `${envName} Railway URL shape check skipped (not in --production mode).`);
  }

  if (productionMode) {
    const localhost = /localhost|127\.0\.0\.1/iu.test(value);
    pushResult(scope, !localhost, localhost ? `${envName} must not point to localhost in production.` : `${envName} is not localhost.`);
  }
}

function normalizeUrlHost(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

function pushResult(name, ok, message) {
  results.push({ name, ok, message });
}

function printSummary(allResults) {
  const width = allResults.reduce((max, item) => Math.max(max, item.name.length), 5);
  console.log('\nRailway + Supabase env validation\n');

  for (const item of allResults) {
    const status = item.ok ? 'PASS' : 'FAIL';
    console.log(`${status.padEnd(4)}  ${item.name.padEnd(width)}  ${item.message}`);
  }

  const passed = allResults.filter((item) => item.ok).length;
  const failed = allResults.length - passed;
  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
}

function failFast(message) {
  console.error(message);
  process.exit(2);
}
