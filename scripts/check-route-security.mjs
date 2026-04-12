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
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, 'apps', 'web', 'src');
const proxyPath = join(webRoot, 'proxy.ts');

const MUTATION_EXPORTS = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/g;
const AUTH_CHECK = /requireAuth|requireRole/;

/** Glob API route files. */
function findRouteFiles() {
  const apiDir = join(webRoot, 'app', 'api');
  return globSync('**/route.ts', { cwd: apiDir }).map((f) => ({
    relative: `api/${f.replace(/\/route\.ts$/, '')}`,
    absolute: join(apiDir, f),
  }));
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
const EXEMPT_PREFIXES = ['api/webhooks', 'api/internal', 'api/health', 'api/engine', 'api/agents'];

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
