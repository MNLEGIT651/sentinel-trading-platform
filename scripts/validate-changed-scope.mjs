#!/usr/bin/env node
/**
 * Changed-scope validator for bounded diffs.
 *
 * Philosophy source of truth:
 *   docs/ai/commands.md
 *
 * Usage:
 *   node scripts/validate-changed-scope.mjs
 *   node scripts/validate-changed-scope.mjs --dry-run
 *
 * Exit codes:
 *   0 = all executed validations passed
 *   1 = one or more executed validations failed
 *   2 = warnings-only / manual-review-required
 */

import { execSync, spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
let diffBaseline = 'origin/main...HEAD';

/**
 * @typedef {{ command: string, result: '✅ PASS' | '❌ FAIL' | '⏭️ SKIPPED', notes: string }} Row
 */

/**
 * @param {string} command
 * @returns {string}
 */
function sh(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/**
 * @param {string} command
 * @returns {{ ok: boolean, stdout: string, stderr: string }}
 */
function run(command) {
  const completed = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: completed.status === 0,
    stdout: completed.stdout ?? '',
    stderr: completed.stderr ?? '',
  };
}

/**
 * @param {string[]} files
 */
function classify(files) {
  const areas = new Set();

  for (const file of files) {
    if (
      file === 'AGENTS.md'
      || file === 'WORKLOG.md'
      || file.startsWith('docs/')
      || file.endsWith('.md')
    ) {
      areas.add('docs');
    }
    if (file.startsWith('apps/web/')) areas.add('web');
    if (file.startsWith('apps/agents/')) areas.add('agents');
    if (file.startsWith('apps/engine/')) areas.add('engine');
    if (file.startsWith('packages/shared/')) areas.add('shared');
    if (file.startsWith('.github/') || file.startsWith('scripts/')) areas.add('ci');
    if (file.startsWith('supabase/migrations/')) areas.add('migrations');
  }

  const coreAreas = [...areas].filter((area) => !['docs', 'ci'].includes(area));
  if (
    (areas.has('shared') && coreAreas.length > 1)
    || (areas.has('migrations') && coreAreas.length > 1)
    || coreAreas.length > 2
  ) {
    areas.add('mixed/high-risk');
  }

  return areas;
}

/**
 * @param {string[]} files
 */
function needsWebBuild(files) {
  return files.some((file) => (
    file.startsWith('apps/web/src/app/')
    || file === 'apps/web/src/proxy.ts'
    || file === 'apps/web/src/lib/engine-fetch.ts'
    || file === 'apps/web/src/lib/engine-client.ts'
    || file.startsWith('apps/web/src/lib/server/')
    || file === 'apps/web/next.config.ts'
    || file === 'apps/web/next.config.mjs'
    || file === 'apps/web/playwright.config.ts'
    || file === 'apps/web/vercel.json'
  ));
}

/**
 * @param {string[]} files
 */
function sharedTouchesEngineFlow(files) {
  return files.some((file) => (
    file.startsWith('apps/engine/')
    || file === 'apps/web/src/proxy.ts'
    || file === 'apps/web/src/lib/engine-fetch.ts'
    || file === 'apps/web/src/lib/engine-client.ts'
    || file === 'apps/agents/src/engine-client.ts'
  ));
}

/**
 * @param {string[]} files
 */
function shouldRunSecurityAudit(files) {
  return files.some((file) => (
    file.startsWith('.github/workflows/')
    || file === '.github/dependabot.yml'
    || file === 'scripts/security-audit.mjs'
  ));
}

/**
 * @param {Set<string>} areas
 * @param {string[]} files
 */
function buildPlan(areas, files) {
  /** @type {{ command: string, reason: string }[]} */
  const execute = [];
  /** @type {Row[]} */
  const preSkipped = [];
  const add = (command, reason) => {
    if (!execute.some((c) => c.command === command)) execute.push({ command, reason });
  };
  const skip = (command, notes) => {
    preSkipped.push({ command, result: '⏭️ SKIPPED', notes });
  };

  if (areas.has('docs')) add('git diff --check', 'docs validation baseline');

  if (areas.has('web')) {
    add('pnpm lint', 'web area');
    add('pnpm test:web', 'web area');
    if (needsWebBuild(files)) {
      add('pnpm --filter @sentinel/web build', 'web routing/data-fetching/config touched');
    } else {
      skip('pnpm --filter @sentinel/web build', 'web changed, but no routing/data-fetching/config changes detected');
    }
  }

  if (areas.has('agents')) {
    add('pnpm lint', 'agents area');
    add('pnpm test:agents', 'agents area');
  }

  if (areas.has('engine')) {
    add('pnpm lint:engine', 'engine area');
    add('pnpm format:check:engine', 'engine area');
    add('pnpm test:engine', 'engine area');
  }

  if (areas.has('shared')) {
    add('pnpm lint', 'shared/contracts area');
    add('pnpm test', 'shared/contracts area');
    add('pnpm --filter @sentinel/web build', 'shared can impact web consumers');
    if (sharedTouchesEngineFlow(files)) {
      add('pnpm test:engine', 'shared changes touch engine-facing flows');
    } else {
      skip('pnpm test:engine', 'shared changed, but no explicit engine-facing flow signals detected');
    }
  }

  if (areas.has('ci')) {
    add('git diff --check', 'ci/workflow safety baseline');
    if (shouldRunSecurityAudit(files)) {
      add('node scripts/security-audit.mjs', 'workflow/dependency-audit automation changed');
    } else {
      skip('node scripts/security-audit.mjs', 'ci changed, but no workflow/permissions/dependency-audit automation changes detected');
    }
  }

  if (areas.has('migrations')) {
    skip(
      'manual migration review',
      'supabase/migrations changes require explicit manual review and broader validation than scoped automation',
    );
  }

  return { execute, preSkipped };
}

/**
 * @param {Row[]} rows
 */
function printTable(rows) {
  console.log('\n| Command | Result | Notes |');
  console.log('|---------|--------|-------|');
  for (const row of rows) {
    console.log(`| \`${row.command}\` | ${row.result} | ${row.notes} |`);
  }
}

function main() {
  let diffOutput = '';
  try {
    diffOutput = sh('git diff --name-only origin/main...HEAD');
  } catch (error) {
    try {
      sh('git fetch origin main --quiet');
      diffOutput = sh('git diff --name-only origin/main...HEAD');
    } catch {
      try {
        diffOutput = sh('git diff --name-only work...HEAD');
        diffBaseline = 'work...HEAD (fallback: origin/main unavailable locally)';
      } catch {
        console.error('❌ Unable to read changed files from origin/main...HEAD.');
        console.error('Run `git fetch origin main` and retry.');
        process.exit(1);
      }
    }
  }

  const files = diffOutput.split('\n').map((line) => line.trim()).filter(Boolean);
  if (files.length === 0) {
    console.log('✅ No changed files detected (origin/main...HEAD). Nothing to validate.');
    process.exit(0);
  }

  const areas = classify(files);
  const { execute, preSkipped } = buildPlan(areas, files);

  if (dryRun) {
    console.log('## Changed Scope (dry-run)');
    console.log(`\nBaseline: \`${diffBaseline}\``);
    console.log('\n### Detected files');
    files.forEach((f) => console.log(`- ${f}`));
    console.log('\n### Classified areas');
    [...areas].sort().forEach((area) => console.log(`- ${area}`));
    console.log('\n### Commands that would run');
    execute.forEach((item) => console.log(`- ${item.command} (${item.reason})`));
    if (preSkipped.length > 0) {
      console.log('\n### Commands that would be skipped');
      preSkipped.forEach((item) => console.log(`- ${item.command} (${item.notes})`));
    }
    process.exit(0);
  }

  /** @type {Row[]} */
  const rows = [];
  let hasFailure = false;
  let hasWarningOnly = false;

  for (const command of execute) {
    const result = run(command.command);
    if (result.ok) {
      rows.push({
        command: command.command,
        result: '✅ PASS',
        notes: command.reason,
      });
    } else {
      hasFailure = true;
      const detail = (result.stderr || result.stdout).trim().split('\n').pop() || 'command failed';
      rows.push({
        command: command.command,
        result: '❌ FAIL',
        notes: detail.replace(/\|/g, '\\|'),
      });
    }
  }

  for (const skipped of preSkipped) {
    rows.push(skipped);
    if (skipped.command === 'manual migration review') hasWarningOnly = true;
  }

  if (areas.has('mixed/high-risk')) {
    hasWarningOnly = true;
    rows.push({
      command: 'mixed/high-risk scope review',
      result: '⏭️ SKIPPED',
      notes: 'scope crosses multiple high-risk areas; run broader validation (`pnpm pre-pr`) before merge',
    });
  }

  console.log('## Validation Results');
  console.log(`\nBaseline: \`${diffBaseline}\``);
  printTable(rows);

  console.log('\n### Skipped Validations');
  const skippedRows = rows.filter((row) => row.result === '⏭️ SKIPPED');
  if (skippedRows.length === 0) {
    console.log('- None');
  } else {
    for (const row of skippedRows) {
      console.log(`- \`${row.command}\` — ${row.notes}`);
    }
  }

  if (hasFailure) process.exit(1);
  if (hasWarningOnly) process.exit(2);
  process.exit(0);
}

main();
