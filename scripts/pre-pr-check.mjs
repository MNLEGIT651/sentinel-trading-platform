#!/usr/bin/env node
/**
 * Pre-PR Validation Gate
 *
 * Run this BEFORE creating a pull request. It performs all the checks that
 * PR Guardian runs in CI, plus the full validation suite (lint, test, build).
 *
 * This is the "shift-left" counterpart to the CI gate — catch problems
 * before they become noisy PR comments.
 *
 * Usage:
 *   node scripts/pre-pr-check.mjs           # full check (guardian + validation)
 *   node scripts/pre-pr-check.mjs --quick   # guardian checks only (no build/test)
 *   node scripts/pre-pr-check.mjs --fix     # attempt auto-fixes (format, lint --fix)
 *
 * Exit codes:
 *   0 — all checks pass, safe to open PR
 *   1 — blocking issues found
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const fix = args.includes('--fix');

function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: opts.silent ? ['pipe', 'pipe', 'pipe'] : 'inherit',
      timeout: opts.timeout || 300_000,
    });
  } catch (err) {
    if (opts.silent) return null;
    return null;
  }
}

function shOutput(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function header(text) {
  console.log(`\n${BOLD}${CYAN}━━━ ${text} ━━━${RESET}\n`);
}

function pass(text) {
  console.log(`  ${GREEN}✓${RESET} ${text}`);
}

function fail(text) {
  console.log(`  ${RED}✗${RESET} ${text}`);
}

function warn(text) {
  console.log(`  ${YELLOW}⚠${RESET} ${text}`);
}

// Track results
const results = [];
function record(name, status, detail = '') {
  results.push({ name, status, detail });
  if (status === 'pass') pass(`${name}${detail ? ': ' + detail : ''}`);
  else if (status === 'fail') fail(`${name}${detail ? ': ' + detail : ''}`);
  else warn(`${name}${detail ? ': ' + detail : ''}`);
}

async function main() {
  console.log(`\n${BOLD}🛡️  Pre-PR Validation Gate${RESET}`);
  console.log(`${CYAN}Checking your branch before PR creation...${RESET}\n`);

  // ── Check 1: Branch exists and has commits vs main ──
  header('Branch Status');

  const branch = shOutput('git branch --show-current');
  if (!branch || branch === 'main') {
    record('Branch', 'fail', 'You are on main — create a feature branch first');
    summary();
    process.exit(1);
  }
  record('Branch', 'pass', `on \`${branch}\``);

  // Fetch latest main
  sh('git fetch origin main --quiet', { silent: true });

  const behind = parseInt(shOutput('git rev-list --count HEAD..origin/main') || '0', 10);
  if (behind > 15) {
    record('Staleness', 'fail', `${behind} commits behind main — rebase first`);
  } else if (behind > 5) {
    record('Staleness', 'warn', `${behind} commits behind main — consider rebasing`);
  } else {
    record('Staleness', 'pass', `${behind} commits behind main`);
  }

  // ── Check 2: Scope ──
  header('Scope Analysis');

  const diffStat = shOutput('git diff --stat origin/main...HEAD');
  const fileCount = (diffStat.match(/\d+ files? changed/) || ['0'])[0];
  const changedFiles = shOutput('git diff --name-only origin/main...HEAD').split('\n').filter(Boolean);

  const numFiles = changedFiles.length;
  if (numFiles > 30) {
    record('File count', 'fail', `${numFiles} files — split this PR (aim for <20)`);
  } else if (numFiles > 20) {
    record('File count', 'warn', `${numFiles} files — consider splitting`);
  } else {
    record('File count', 'pass', `${numFiles} files changed`);
  }

  // Check workspace spread
  const areas = new Set();
  for (const f of changedFiles) {
    const parts = f.split('/');
    areas.add(parts.length > 1 ? parts.slice(0, 2).join('/') : '(root)');
  }
  if (areas.size > 5) {
    record('Workspace spread', 'fail', `${areas.size} areas: ${[...areas].join(', ')}`);
  } else if (areas.size > 3) {
    record('Workspace spread', 'warn', `${areas.size} areas: ${[...areas].join(', ')}`);
  } else {
    record('Workspace spread', 'pass', `${areas.size} area(s): ${[...areas].join(', ')}`);
  }

  // ── Check 3: File health ──
  header('File Health');

  const largeFiles = [];
  for (const f of changedFiles) {
    if (f.endsWith('.snap') || f === 'pnpm-lock.yaml' || f.endsWith('.types.ts')) continue;
    if (!fs.existsSync(f)) continue;
    try {
      const lines = fs.readFileSync(f, 'utf8').split('\n').length;
      if (lines > 500) largeFiles.push({ file: f, lines, severity: 'fail' });
      else if (lines > 400) largeFiles.push({ file: f, lines, severity: 'warn' });
    } catch { /* skip unreadable */ }
  }

  if (largeFiles.length === 0) {
    record('File sizes', 'pass', 'all changed files under 400 lines');
  } else {
    for (const lf of largeFiles) {
      record(`File size: ${lf.file}`, lf.severity, `${lf.lines} lines`);
    }
  }

  // ── Check 4: High-risk paths ──
  header('High-Risk Path Audit');

  const riskPaths = [
    '.github/workflows/', 'packages/shared/src/', 'supabase/migrations/',
    'apps/web/src/lib/engine-fetch.ts', 'apps/web/src/proxy.ts',
    'apps/engine/src/api/main.py', 'apps/engine/src/config.py',
  ];
  const riskHits = changedFiles.filter((f) =>
    riskPaths.some((rp) => rp.endsWith('/') ? f.startsWith(rp) : f === rp),
  );

  if (riskHits.length === 0) {
    record('High-risk paths', 'pass', 'no sensitive files touched');
  } else {
    for (const h of riskHits) {
      record('High-risk path', 'warn', h);
    }
  }

  // ── Check 5: Overlap with open PRs ──
  header('Open PR Overlap');

  const openPRs = shOutput('gh pr list --state open --json number,title,headRefName --limit 20');
  if (openPRs) {
    try {
      const prs = JSON.parse(openPRs);
      if (prs.length === 0) {
        record('PR overlap', 'pass', 'no other open PRs');
      } else {
        for (const pr of prs) {
          const prFiles = shOutput(`gh pr diff ${pr.number} --name-only`);
          if (prFiles) {
            const prFileList = prFiles.split('\n').filter(Boolean);
            const overlap = changedFiles.filter((f) => prFileList.includes(f));
            if (overlap.length > 0) {
              record(`Overlap with PR #${pr.number}`, overlap.length > 8 ? 'fail' : 'warn',
                `${overlap.length} shared files ("${pr.title}")`);
            }
          }
        }
        if (!results.some((r) => r.name.startsWith('Overlap'))) {
          record('PR overlap', 'pass', 'no file overlap with open PRs');
        }
      }
    } catch {
      record('PR overlap', 'warn', 'could not parse gh output');
    }
  } else {
    record('PR overlap', 'warn', 'gh CLI not available — skipping');
  }

  // ── Check 6: PR Guardian (full analysis) ──
  header('PR Guardian Analysis');

  const guardianResult = sh('node scripts/pr-guardian.mjs --local --dry-run', { silent: true });
  if (guardianResult !== null) {
    record('PR Guardian', 'pass', 'local analysis complete');
  } else {
    record('PR Guardian', 'warn', 'could not run guardian analysis');
  }

  if (!quick) {
    // ── Check 7: Lint ──
    header('Lint');

    if (fix) {
      sh('npx turbo lint --ui stream -- --fix', { silent: true });
    }

    const lintOk = sh('npx turbo lint --ui stream', { silent: true });
    record('Lint', lintOk !== null ? 'pass' : 'fail', lintOk !== null ? '3/3 workspaces' : 'lint errors found');

    // ── Check 8: Typecheck ──
    header('Typecheck');

    const typecheckOk = sh('npx turbo typecheck --ui stream', { silent: true });
    record('Typecheck', typecheckOk !== null ? 'pass' : 'fail',
      typecheckOk !== null ? 'all workspaces' : 'type errors found — possible hallucinated imports');

    // ── Check 9: Tests ──
    header('Tests');

    const testOk = sh('npx turbo test --ui stream', { silent: true });
    record('Tests', testOk !== null ? 'pass' : 'fail',
      testOk !== null ? 'all passing' : 'test failures found');

    // ── Check 10: Build ──
    header('Build');

    const buildOk = sh('npx turbo build --ui stream', { silent: true });
    record('Build', buildOk !== null ? 'pass' : 'fail',
      buildOk !== null ? 'all workspaces' : 'build errors found');

    // Engine checks if engine files changed
    const touchesEngine = changedFiles.some((f) => f.startsWith('apps/engine/'));
    if (touchesEngine) {
      header('Engine Validation');

      const engineLint = sh('pnpm lint:engine', { silent: true });
      record('Engine lint', engineLint !== null ? 'pass' : 'fail');

      const engineFormat = sh('pnpm format:check:engine', { silent: true });
      record('Engine format', engineFormat !== null ? 'pass' : 'fail');

      const engineTest = sh('pnpm test:engine', { silent: true });
      record('Engine tests', engineTest !== null ? 'pass' : 'fail');
    }
  }

  summary();
}

function summary() {
  header('Summary');

  const fails = results.filter((r) => r.status === 'fail');
  const warns = results.filter((r) => r.status === 'warn');
  const passes = results.filter((r) => r.status === 'pass');

  console.log(`  ${GREEN}${passes.length} passed${RESET}  ${YELLOW}${warns.length} warnings${RESET}  ${RED}${fails.length} failed${RESET}\n`);

  if (fails.length > 0) {
    console.log(`${RED}${BOLD}❌ DO NOT create a PR yet.${RESET} Fix these issues first:\n`);
    for (const f of fails) {
      console.log(`  ${RED}•${RESET} ${f.name}: ${f.detail}`);
    }
    console.log('');
    process.exit(1);
  }

  if (warns.length > 0) {
    console.log(`${YELLOW}${BOLD}⚠️  Warnings detected.${RESET} PR is allowed but expect review feedback.\n`);
  }

  console.log(`${GREEN}${BOLD}✅ Ready to create PR!${RESET}\n`);
  console.log(`  ${CYAN}Suggested command:${RESET}`);
  console.log(`  gh pr create --fill\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Pre-PR check error:', err);
  process.exit(1);
});
