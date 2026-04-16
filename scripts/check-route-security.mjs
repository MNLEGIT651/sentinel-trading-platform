#!/usr/bin/env node
/**
 * CI guard: verifies CSRF enforcement via proxy.ts and that all
 * non-exempt API mutation routes have proper auth coverage.
 *
 * Checks:
 * 1. apps/web/src/proxy.ts exists with CSRF enforcement for mutations
 * 2. All mutation routes (POST/PUT/PATCH/DELETE) call requireAuth or requireRole
 * 3. No mutating routes are in PUBLIC_API_PATHS / PUBLIC_PREFIXES
 *
 * Usage:
 *   node scripts/check-route-security.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, 'apps', 'web', 'src');
const proxyPath = join(webRoot, 'proxy.ts');

const MUTATION_EXPORTS = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/g;
const AUTH_CHECK = /requireAuth|requireRole/;

/** Glob API route files. */
function findRouteFiles() {
  const apiDir = join(webRoot, 'app', 'api');
  const files = [];
  const walk = (dir, relativePrefix = '') => {
    for (const name of readdirSync(dir)) {
      const absolute = join(dir, name);
      const relative = relativePrefix ? `${relativePrefix}/${name}` : name;
      if (statSync(absolute).isDirectory()) {
        walk(absolute, relative);
      } else if (name === 'route.ts') {
        files.push({
          relative: `api/${relative.replace(/\/route\.ts$/, '')}`,
          absolute,
        });
      }
    }
  };
  walk(apiDir);
  return files;
}

const errors = [];

// ─── Check 1: Proxy-level CSRF enforcement ───────────────────────────────
if (!existsSync(proxyPath)) {
  errors.push('CRITICAL: apps/web/src/proxy.ts is missing. No edge-level security.');
} else {
  const content = readFileSync(proxyPath, 'utf8');

  if (!content.includes('checkCsrf')) {
    errors.push('proxy.ts does not call checkCsrf — CSRF protection is not active.');
  }
  if (!content.includes('MUTATION_METHODS')) {
    errors.push('proxy.ts does not define MUTATION_METHODS — mutation filtering is missing.');
  }
  if (!content.includes('CSRF_EXEMPT_PREFIXES')) {
    errors.push('proxy.ts does not define CSRF_EXEMPT_PREFIXES — exemption model is missing.');
  }
}

// ─── Check 2: Route-level auth coverage ──────────────────────────────────
const EXEMPT_PREFIXES = ['api/webhooks', 'api/internal', 'api/health'];

const routeFiles = findRouteFiles();
let mutationRouteCount = 0;
let authMissingCount = 0;

for (const { relative, absolute } of routeFiles) {
  const content = readFileSync(absolute, 'utf8');
  const mutations = [...content.matchAll(MUTATION_EXPORTS)].map((m) => m[1]);

  if (mutations.length === 0) continue;
  mutationRouteCount++;

  // Skip exempt routes (webhooks use signature verification, proxied routes use upstream auth)
  if (EXEMPT_PREFIXES.some((p) => relative.startsWith(p))) continue;

  // Check that requireAuth or requireRole is called
  if (!AUTH_CHECK.test(content)) {
    errors.push(`${relative}: exports ${mutations.join(', ')} but does not call requireAuth() or requireRole()`);
    authMissingCount++;
  }
}

// ─── Check 3: proxy trust-boundary allowlists are present ─────────────────
const engineProxyPath = join(webRoot, 'app', 'api', 'engine', '[...path]', 'route.ts');
const agentsProxyPath = join(webRoot, 'app', 'api', 'agents', '[...path]', 'route.ts');

if (!existsSync(engineProxyPath)) {
  errors.push('CRITICAL: engine proxy route is missing.');
} else {
  const content = readFileSync(engineProxyPath, 'utf8');
  if (!content.includes('SAFE_READ_PREFIXES') || !content.includes('OPERATOR_MUTATION_PREFIXES')) {
    errors.push(
      'api/engine proxy must define explicit SAFE_READ_PREFIXES and OPERATOR_MUTATION_PREFIXES allowlists.',
    );
  }
  if (!content.includes('Mutating engine path is denied by proxy policy')) {
    errors.push('api/engine proxy must deny unknown mutating paths by default.');
  }
}

if (!existsSync(agentsProxyPath)) {
  errors.push('CRITICAL: agents proxy route is missing.');
} else {
  const content = readFileSync(agentsProxyPath, 'utf8');
  if (!content.includes('SAFE_READ_PREFIXES') || !content.includes('OPERATOR_MUTATION_PATHS')) {
    errors.push(
      'api/agents proxy must define explicit SAFE_READ_PREFIXES and OPERATOR_MUTATION_PATHS allowlists.',
    );
  }
  if (!content.includes('Agents path is denied by proxy policy')) {
    errors.push('api/agents proxy must deny unknown paths by default.');
  }
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log('\n=== Route Security Audit ===\n');
console.log(`Proxy CSRF:       ${existsSync(proxyPath) ? 'PRESENT' : 'MISSING'}`);
console.log(`Mutation routes:  ${mutationRouteCount}`);
console.log(`Auth missing:     ${authMissingCount}`);

if (errors.length > 0) {
  console.log('\nERRORS:');
  for (const e of errors) console.error(`  ✗ ${e}`);
}

if (errors.length === 0) {
  console.log('\n✓ All checks passed.');
}

// Fail CI on any error (CSRF gaps or missing auth)
process.exit(errors.length > 0 ? 1 : 0);
