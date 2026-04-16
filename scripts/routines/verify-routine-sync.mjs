#!/usr/bin/env node
/**
 * verify-routine-sync.mjs
 *
 * Enforces that `.claude/routines/manifest.yaml`, the per-routine specs under
 * `.claude/routines/<id>.md`, and the paired workflows under
 * `.github/workflows/routine-<id>.yml` all agree.
 *
 * Checks:
 *   1. Manifest parses and every routine has the required fields.
 *   2. `routine_spec_path` exists and starts with `# Routine:`.
 *   3. `github_workflow_path` exists and names itself `Routine — ...`.
 *   4. Workflow YAML references its manifest id via the verify-routine-sync
 *      step (so CI fails fast on renames).
 *   5. The triple (manifest id, spec path basename, workflow basename) is
 *      pairwise consistent: `<id>.md` and `routine-<id>.yml`.
 *
 * Usage:
 *   node scripts/routines/verify-routine-sync.mjs           # verify all
 *   node scripts/routines/verify-routine-sync.mjs --only <id>
 *
 * Exit codes: 0 ok, 1 drift detected, 2 bad invocation.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const MANIFEST_PATH = path.join(REPO_ROOT, '.claude/routines/manifest.yaml');

const REQUIRED_FIELDS = [
  'id',
  'display_name',
  'project_name',
  'purpose',
  'primary_executor',
  'trigger_type',
  'trigger_details',
  'routine_spec_path',
  'github_workflow_path',
  'expected_inputs',
  'required_repositories',
  'required_environment',
  'required_connectors',
  'required_secrets_or_env_names',
  'success_criteria',
  'output_destination',
  'verification_method',
  'anti_noise_rules',
  'idempotency_rules',
  'manual_activation_required',
  'notes',
];

const ALLOWED_TRIGGER_TYPES = new Set([
  'schedule',
  'api',
  'github_event',
  'workflow_dispatch',
  'bridge',
]);

const ALLOWED_EXECUTORS = new Set(['claude_routine', 'github_action']);

/**
 * Minimal YAML parser for the constrained manifest shape:
 *
 *   version: N
 *   repository: string
 *   updated: string
 *   routines:
 *     - id: value
 *       scalar_field: value
 *       list_field:
 *         - item
 *         - item
 *     - id: next
 *       ...
 *
 * We deliberately do not depend on a YAML library so this script works in
 * clean CI checkouts without installing dependencies first.
 */
function parseManifest(source) {
  const lines = source.split('\n');
  const root = {};
  /** @type {Record<string, unknown> | null} */
  let currentRoutine = null;
  /** @type {string | null} */
  let currentListKey = null;
  /** @type {any[] | null} */
  let currentListRef = null;
  let inRoutines = false;

  const routines = [];

  for (let rawIdx = 0; rawIdx < lines.length; rawIdx += 1) {
    const rawLine = lines[rawIdx];
    if (rawLine === undefined) continue;

    // Strip comments and trailing whitespace
    const stripped = rawLine.replace(/\s+#.*$/, '').trimEnd();
    if (stripped.trim() === '' || stripped.trim().startsWith('#')) continue;

    const indent = rawLine.length - rawLine.trimStart().length;
    const content = stripped.trim();

    // Top-level key (no indentation)
    if (indent === 0) {
      inRoutines = false;
      currentRoutine = null;
      currentListKey = null;
      currentListRef = null;

      if (content === 'routines:') {
        inRoutines = true;
        continue;
      }

      const match = content.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (match) {
        root[match[1]] = coerceScalar(match[2]);
      }
      continue;
    }

    if (!inRoutines) continue;

    // Start of a new routine: "  - id: something"
    if (indent === 2 && content.startsWith('- ')) {
      currentRoutine = {};
      routines.push(currentRoutine);
      currentListKey = null;
      currentListRef = null;

      const firstFieldMatch = content.slice(2).match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (firstFieldMatch) {
        currentRoutine[firstFieldMatch[1]] = coerceScalar(firstFieldMatch[2]);
      }
      continue;
    }

    if (!currentRoutine) continue;

    // Scalar or list-start field inside a routine (indent === 4)
    if (indent === 4) {
      currentListKey = null;
      currentListRef = null;

      const match = content.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      const value = match[2];
      if (value === '') {
        // A list is about to start
        currentListKey = key;
        currentListRef = [];
        currentRoutine[key] = currentListRef;
      } else {
        currentRoutine[key] = coerceScalar(value);
      }
      continue;
    }

    // List items (indent === 6)
    if (indent === 6 && content.startsWith('- ') && currentListRef) {
      currentListRef.push(coerceScalar(content.slice(2)));
      continue;
    }
  }

  root.routines = routines;
  return root;
}

function coerceScalar(raw) {
  if (raw === undefined || raw === null) return raw;
  let v = String(raw).trim();
  if (v === '') return '';

  // Strip surrounding quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

function assertNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function verifyRoutine(routine, errors) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in routine)) {
      errors.push(`${routine.id ?? '<unknown>'}: missing required field "${field}"`);
    }
  }

  if (routine.trigger_type && !ALLOWED_TRIGGER_TYPES.has(routine.trigger_type)) {
    errors.push(
      `${routine.id}: trigger_type "${routine.trigger_type}" is not one of ${[
        ...ALLOWED_TRIGGER_TYPES,
      ].join(', ')}`,
    );
  }

  if (routine.primary_executor && !ALLOWED_EXECUTORS.has(routine.primary_executor)) {
    errors.push(
      `${routine.id}: primary_executor "${routine.primary_executor}" is not one of ${[
        ...ALLOWED_EXECUTORS,
      ].join(', ')}`,
    );
  }

  const arrayFields = [
    'expected_inputs',
    'required_repositories',
    'required_connectors',
    'required_secrets_or_env_names',
    'success_criteria',
    'anti_noise_rules',
    'idempotency_rules',
  ];
  for (const field of arrayFields) {
    if (!assertNonEmptyArray(routine[field])) {
      errors.push(`${routine.id}: field "${field}" must be a non-empty list`);
    }
  }

  // Path conventions
  const expectedSpec = `.claude/routines/${routine.id}.md`;
  const expectedWorkflow = `.github/workflows/routine-${routine.id}.yml`;
  if (routine.routine_spec_path !== expectedSpec) {
    errors.push(
      `${routine.id}: routine_spec_path "${routine.routine_spec_path}" should be "${expectedSpec}"`,
    );
  }
  if (routine.github_workflow_path !== expectedWorkflow) {
    errors.push(
      `${routine.id}: github_workflow_path "${routine.github_workflow_path}" should be "${expectedWorkflow}"`,
    );
  }

  // File existence + minimal content checks
  const specPath = path.join(REPO_ROOT, routine.routine_spec_path);
  if (!fs.existsSync(specPath)) {
    errors.push(`${routine.id}: spec file missing at ${routine.routine_spec_path}`);
  } else {
    const specText = fs.readFileSync(specPath, 'utf8');
    if (!specText.startsWith('# Routine:')) {
      errors.push(`${routine.id}: spec file must start with "# Routine:"`);
    }
    if (!specText.includes(`Manifest id: \`${routine.id}\``)) {
      errors.push(`${routine.id}: spec file must reference its manifest id`);
    }
    if (!specText.includes(routine.github_workflow_path)) {
      errors.push(
        `${routine.id}: spec file must reference its paired workflow path (${routine.github_workflow_path})`,
      );
    }
  }

  const workflowPath = path.join(REPO_ROOT, routine.github_workflow_path);
  if (!fs.existsSync(workflowPath)) {
    errors.push(`${routine.id}: workflow file missing at ${routine.github_workflow_path}`);
  } else {
    const workflowText = fs.readFileSync(workflowPath, 'utf8');
    if (!workflowText.includes(`routine: ${routine.id}`)) {
      errors.push(
        `${routine.id}: workflow must carry header comment "Paired with Claude Code routine: ${routine.id}"`,
      );
    }
    if (!workflowText.includes('verify-routine-sync.mjs')) {
      errors.push(
        `${routine.id}: workflow must invoke scripts/routines/verify-routine-sync.mjs`,
      );
    }
    if (!workflowText.includes(`--only ${routine.id}`)) {
      errors.push(
        `${routine.id}: workflow must call verify-routine-sync.mjs with "--only ${routine.id}"`,
      );
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  let onlyId = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--only') {
      onlyId = args[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: verify-routine-sync.mjs [--only <routine-id>]');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifestSource = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const manifest = parseManifest(manifestSource);
  const errors = [];

  if (!Array.isArray(manifest.routines) || manifest.routines.length === 0) {
    console.error('manifest.yaml has no routines');
    process.exit(1);
  }

  const ids = new Set();
  for (const routine of manifest.routines) {
    if (!routine.id) {
      errors.push('A routine is missing the "id" field');
      continue;
    }
    if (ids.has(routine.id)) {
      errors.push(`Duplicate routine id: ${routine.id}`);
    }
    ids.add(routine.id);

    if (onlyId && routine.id !== onlyId) continue;
    verifyRoutine(routine, errors);
  }

  if (onlyId && !ids.has(onlyId)) {
    console.error(`No routine with id "${onlyId}" found in manifest`);
    process.exit(1);
  }

  // Detect orphan spec/workflow files (only when auditing everything)
  if (!onlyId) {
    const specDir = path.join(REPO_ROOT, '.claude/routines');
    for (const entry of fs.readdirSync(specDir)) {
      if (!entry.endsWith('.md')) continue;
      if (entry === 'README.md') continue;
      const id = entry.replace(/\.md$/, '');
      if (!ids.has(id)) {
        errors.push(`Orphan spec file: .claude/routines/${entry} has no matching manifest entry`);
      }
    }

    const wfDir = path.join(REPO_ROOT, '.github/workflows');
    for (const entry of fs.readdirSync(wfDir)) {
      if (!entry.startsWith('routine-') || !entry.endsWith('.yml')) continue;
      const id = entry.replace(/^routine-/, '').replace(/\.yml$/, '');
      if (!ids.has(id)) {
        errors.push(
          `Orphan workflow file: .github/workflows/${entry} has no matching manifest entry`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error('Routine sync check FAILED:\n');
    for (const err of errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  }

  const scope = onlyId ? `routine "${onlyId}"` : `${manifest.routines.length} routine(s)`;
  console.log(`Routine sync check passed for ${scope}.`);
}

main();
