#!/usr/bin/env node
/**
 * Validates env against the contract used by web / engine / agents.
 *
 * Usage:
 *   node scripts/check-env-contract.mjs
 *   node scripts/check-env-contract.mjs --json
 *
 * Tests can import `checkContract` with a plain object (no filesystem).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} raw */
export function parseDotenv(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    const q = val[0];
    if (q === '"' || q === "'") {
      let end = 1;
      while (end < val.length && val[end] !== q) {
        if (val[end] === '\\') end += 1;
        end += 1;
      }
      val = val.slice(1, end);
    } else {
      const hash = val.indexOf(' #');
      if (hash !== -1) val = val.slice(0, hash).trim();
    }
    out[key] = val;
  }
  return out;
}

function hasSupabaseClientKey(env) {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

function nonEmpty(env, key) {
  return Boolean(env[key]?.trim());
}

/** @typedef {{ id: string; label: string; keys: string[]; check?: (e: Record<string,string>) => string[] }} Check */

/** @type {Check[]} */
const WEB_REQUIRED = [
  {
    id: 'web.supabase.url',
    label: '[web] NEXT_PUBLIC_SUPABASE_URL',
    keys: ['NEXT_PUBLIC_SUPABASE_URL'],
  },
  {
    id: 'web.supabase.client',
    label: '[web] one of NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | DEFAULT_KEY | ANON_KEY',
    keys: [],
    check: (e) => (hasSupabaseClientKey(e) ? [] : ['(no client key set)']),
  },
];

/** @type {Check[]} */
const WEB_RECOMMENDED = [
  {
    id: 'web.admin',
    label: '[web] SUPABASE_SERVICE_ROLE_KEY (server routes, webhooks)',
    keys: ['SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'web.engine',
    label: '[web] ENGINE_URL + ENGINE_API_KEY',
    keys: ['ENGINE_URL', 'ENGINE_API_KEY'],
  },
  {
    id: 'web.agents',
    label: '[web] AGENTS_URL',
    keys: ['AGENTS_URL'],
  },
];

/** @type {Check[]} */
const ENGINE_REQUIRED = [
  {
    id: 'engine.core',
    label: '[engine] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ENGINE_API_KEY',
    keys: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ENGINE_API_KEY'],
  },
];

/** @type {Check[]} */
const AGENTS_REQUIRED = [
  {
    id: 'agents.bundle',
    label: '[agents] ANTHROPIC + SUPABASE + ENGINE bundle',
    keys: [
      'ANTHROPIC_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_JWT_SECRET',
      'ENGINE_URL',
      'ENGINE_API_KEY',
    ],
  },
];

/**
 * @param {Check[]} checks
 * @param {Record<string, string>} env
 */
function formatFailures(checks, env) {
  /** @type {string[]} */
  const lines = [];
  for (const c of checks) {
    const miss = c.check ? c.check(env) : c.keys.filter((k) => !nonEmpty(env, k));
    if (miss.length) lines.push(`  ✗ ${c.label}\n      missing: ${miss.join(', ')}`);
  }
  return lines;
}

/**
 * @param {Record<string, string>} env
 */
export function checkContract(env) {
  const webReqMiss = formatFailures(WEB_REQUIRED, env);
  const engMiss = formatFailures(ENGINE_REQUIRED, env);
  const agMiss = formatFailures(AGENTS_REQUIRED, env);
  const webRecMiss = formatFailures(WEB_RECOMMENDED, env);

  const ok = webReqMiss.length === 0 && engMiss.length === 0 && agMiss.length === 0;

  const hostPublic = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  const hostServer = env.SUPABASE_URL?.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  const hostMismatch =
    Boolean(hostPublic && hostServer && hostPublic !== hostServer) &&
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL hosts differ — use the same Supabase project.';

  return {
    ok,
    webReqMiss,
    engMiss,
    agMiss,
    webRecMiss,
    warnings: hostMismatch ? [hostMismatch] : [],
  };
}

function main() {
  const json = process.argv.includes('--json');
  const envPath = join(root, '.env');

  if (!existsSync(envPath)) {
    const msg = `No ${envPath} — copy .env.example to .env and fill values.`;
    if (json) console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    else console.error(msg);
    process.exit(1);
  }

  const env = parseDotenv(readFileSync(envPath, 'utf8'));
  const result = checkContract(env);

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          path: envPath,
          missing: {
            webRequired: result.webReqMiss,
            engineRequired: result.engMiss,
            agentsRequired: result.agMiss,
            webRecommended: result.webRecMiss,
          },
          warnings: result.warnings,
        },
        null,
        2,
      ),
    );
    process.exit(result.ok ? 0 : 1);
  }

  console.log(`Sentinel env contract check\nReading: ${envPath}\n`);

  if (result.webReqMiss.length) {
    console.log('── Web (required) ──');
    result.webReqMiss.forEach((l) => console.log(l));
    console.log('');
  } else {
    console.log('── Web (required) ──\n  ✓ Supabase URL + client key\n');
  }

  if (result.engMiss.length) {
    console.log('── Engine (required for Settings.validate) ──');
    result.engMiss.forEach((l) => console.log(l));
    console.log('');
  } else {
    console.log('── Engine (required) ──\n  ✓ Core Supabase + ENGINE_API_KEY\n');
  }

  if (result.agMiss.length) {
    console.log('── Agents (required at boot) ──');
    result.agMiss.forEach((l) => console.log(l));
    console.log('');
  } else {
    console.log('── Agents (required) ──\n  ✓ All six boot variables\n');
  }

  if (result.webRecMiss.length) {
    console.log('── Web (recommended) ──');
    result.webRecMiss.forEach((l) => console.log(l));
    console.log('');
  }

  for (const w of result.warnings) console.log(`⚠ ${w}\n`);

  if (result.ok) {
    console.log('✓ Full stack required variables present.\n');
    process.exit(0);
  }

  console.error('✗ Fix missing values above (see .env.example).\n');
  process.exit(1);
}

const entryArg = process.argv[1];
const isMain =
  Boolean(entryArg) &&
  import.meta.url === pathToFileURL(resolve(process.cwd(), entryArg)).href;
if (isMain) main();
