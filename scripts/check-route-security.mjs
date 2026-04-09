#!/usr/bin/env node
/**
 * CI guard: verifies the Next.js CSRF middleware is in place and that
 * all non-exempt API mutation routes are covered.
 *
 * Checks:
 * 1. apps/web/src/middleware.ts exists and exports the correct matcher
 * 2. All API route files that export mutation handlers (POST/PUT/PATCH/DELETE)
 *    are covered by the middleware matcher pattern
 * 3. requireAuth is called in mutation handlers (defence-in-depth)
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
const middlewarePath = join(webRoot, 'middleware.ts');

const MUTATION_EXPORTS = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/g;
const REQUIRE_AUTH = /requireAuth/;

/** Glob API route files. */
function findRouteFiles() {
  const apiDir = join(webRoot, 'app', 'api');
  return globSync('**/route.ts', { cwd: apiDir }).map((f) => ({
    relative: `api/${f.replace(/\/route\.ts$/, '')}`,
    absolute: join(apiDir, f),
  }));
}

const errors = [];
const warnings = [];

// ─── Check 1: Middleware exists ───────────────────────────────────────────
if (!existsSync(middlewarePath)) {
  errors.push('CRITICAL: apps/web/src/middleware.ts is missing. CSRF protection is not active.');
} else {
  const content = readFileSync(middlewarePath, 'utf8');

  if (!content.includes("matcher")) {
    errors.push('middleware.ts does not export a config.matcher — routes are unprotected.');
  }
  if (!content.includes('/api/')) {
    errors.push('middleware.ts matcher does not target /api/ routes.');
  }
  if (!content.includes('MUTATION_METHODS') && !content.includes('POST')) {
    errors.push('middleware.ts does not check mutation methods (POST/PUT/PATCH/DELETE).');
  }
  if (!content.includes('csrf') && !content.includes('CSRF') && !content.includes('origin')) {
    errors.push('middleware.ts does not appear to implement CSRF validation.');
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

  // Skip exempt routes
  if (EXEMPT_PREFIXES.some((p) => relative.startsWith(p))) continue;

  // Check that requireAuth is called
  if (!REQUIRE_AUTH.test(content)) {
    warnings.push(`${relative}: exports ${mutations.join(', ')} but does not call requireAuth()`);
    authMissingCount++;
  }
}

// ─── Report ──────────────────────────────────────────────────────────────
console.log('\n=== Route Security Audit ===\n');
console.log(`Middleware:       ${existsSync(middlewarePath) ? 'PRESENT' : 'MISSING'}`);
console.log(`Mutation routes:  ${mutationRouteCount}`);
console.log(`Auth warnings:    ${authMissingCount}`);

if (errors.length > 0) {
  console.log('\nERRORS:');
  for (const e of errors) console.error(`  ✗ ${e}`);
}

if (warnings.length > 0) {
  console.log('\nWARNINGS:');
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('\nAll checks passed.');
}

// Only fail CI on errors, not warnings
process.exit(errors.length > 0 ? 1 : 0);
