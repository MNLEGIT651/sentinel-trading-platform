#!/usr/bin/env node
/**
 * validate-changed-scope.mjs
 *
 * Low-friction validator for bounded AI-generated diffs. Detects changed
 * files vs origin/main, maps them into workspace areas, and runs the minimal
 * matching command set from docs/ai/commands.md.
 *
 * Exit codes:
 *   0 — all executed areas passed
 *   1 — one or more executed areas failed
 *   2 — warnings only (e.g. migrations detected but not executed)
 *
 * Flags:
 *   --dry-run   Print the plan without executing
 *   --base=REF  Override the base ref (default: origin/main)
 */

import { execSync, spawnSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const baseArg = args.find((a) => a.startsWith('--base='));
const baseRef = baseArg ? baseArg.split('=')[1] : 'origin/main';

const AREA_RULES = [
  { area: 'migrations', match: (f) => f.startsWith('supabase/migrations/') },
  { area: 'shared', match: (f) => f.startsWith('packages/shared/') },
  { area: 'web', match: (f) => f.startsWith('apps/web/') },
  { area: 'agents', match: (f) => f.startsWith('apps/agents/') },
  { area: 'engine', match: (f) => f.startsWith('apps/engine/') },
  { area: 'ci', match: (f) => f.startsWith('.github/workflows/') || f.startsWith('.github/actions/') },
  {
    area: 'docs',
    match: (f) =>
      f.endsWith('.md') ||
      f.startsWith('docs/') ||
      f === 'AGENTS.md' ||
      f === 'CLAUDE.md' ||
      f === 'WORKLOG.md' ||
      f === 'README.md',
  },
];

const AREA_COMMANDS = {
  web: [
    ['pnpm', ['--filter', '@sentinel/web', 'lint']],
    ['pnpm', ['--filter', '@sentinel/web', 'build']],
  ],
  agents: [['pnpm', ['--filter', '@sentinel/agents', 'lint']]],
  engine: [
    ['pnpm', ['lint:engine']],
    ['pnpm', ['format:check:engine']],
  ],
  shared: [['pnpm', ['--filter', '@sentinel/shared', 'typecheck']]],
};

function getChangedFiles() {
  try {
    const out = execSync(`git diff --name-only ${baseRef}...HEAD`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (err) {
    console.error(`[validate-changed-scope] Failed to compute diff vs ${baseRef}:`);
    console.error(err.stderr?.toString() || err.message);
    process.exit(1);
  }
}

function classify(files) {
  const areas = new Set();
  for (const file of files) {
    for (const rule of AREA_RULES) {
      if (rule.match(file)) {
        areas.add(rule.area);
        break;
      }
    }
  }
  return areas;
}

function runCommand(cmd, cmdArgs) {
  const full = `${cmd} ${cmdArgs.join(' ')}`;
  console.log(`\n▶ ${full}`);
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  return { command: full, ok: result.status === 0, status: result.status };
}

function formatResult(ok) {
  return ok ? '✅ PASS' : '❌ FAIL';
}

function main() {
  const files = getChangedFiles();
  if (files.length === 0) {
    console.log(`[validate-changed-scope] No changed files vs ${baseRef}.`);
    process.exit(0);
  }

  const areas = classify(files);
  console.log(`[validate-changed-scope] Base: ${baseRef}`);
  console.log(`[validate-changed-scope] Changed files: ${files.length}`);
  console.log(`[validate-changed-scope] Detected areas: ${[...areas].join(', ') || '(none)'}`);

  const plan = [];
  const warnings = [];
  const skipped = [];

  if (areas.has('migrations')) {
    warnings.push({
      area: 'migrations',
      note: 'Migration changes detected — manual review required. Run: supabase db lint',
    });
  }

  for (const area of ['web', 'agents', 'engine', 'shared']) {
    if (areas.has(area)) {
      for (const [cmd, cmdArgs] of AREA_COMMANDS[area]) {
        plan.push({ area, cmd, cmdArgs });
      }
    }
  }

  for (const area of ['docs', 'ci']) {
    if (areas.has(area)) {
      skipped.push({
        area,
        reason: area === 'docs' ? 'no validation applicable' : 'no local validation command mapped — run workflow-lint if needed',
      });
    }
  }

  if (dryRun) {
    console.log('\n[validate-changed-scope] DRY RUN — commands that would run:');
    if (plan.length === 0) {
      console.log('  (none)');
    } else {
      for (const p of plan) {
        console.log(`  [${p.area}] ${p.cmd} ${p.cmdArgs.join(' ')}`);
      }
    }
    if (warnings.length) {
      console.log('\n[validate-changed-scope] Warnings:');
      for (const w of warnings) console.log(`  [${w.area}] ${w.note}`);
    }
    if (skipped.length) {
      console.log('\n[validate-changed-scope] Skipped areas:');
      for (const s of skipped) console.log(`  [${s.area}] ${s.reason}`);
    }
    process.exit(0);
  }

  const results = [];
  for (const p of plan) {
    const r = runCommand(p.cmd, p.cmdArgs);
    results.push({ area: p.area, ...r });
  }

  console.log('\n## Validation Results\n');
  console.log('| Area       | Command                                  | Result    |');
  console.log('| ---------- | ---------------------------------------- | --------- |');
  for (const r of results) {
    const cmdCell = r.command.padEnd(40);
    console.log(`| ${r.area.padEnd(10)} | ${cmdCell} | ${formatResult(r.ok)} |`);
  }
  for (const w of warnings) {
    console.log(`| ${w.area.padEnd(10)} | ${'(manual review required)'.padEnd(40)} | ⚠️ WARN   |`);
  }
  for (const s of skipped) {
    console.log(`| ${s.area.padEnd(10)} | ${'(no validation applicable)'.padEnd(40)} | ⏭️ SKIP   |`);
  }

  const anyFail = results.some((r) => !r.ok);
  if (anyFail) {
    console.error('\n[validate-changed-scope] One or more validations failed.');
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.warn('\n[validate-changed-scope] Completed with warnings.');
    process.exit(2);
  }
  console.log('\n[validate-changed-scope] All executed validations passed.');
  process.exit(0);
}

main();
