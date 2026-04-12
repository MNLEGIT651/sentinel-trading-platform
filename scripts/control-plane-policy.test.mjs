import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPolicyVerdict,
  HUMAN_APPROVAL_LABEL,
  CHANGES_REQUESTED_LABEL,
} from './lib/control-plane-policy.mjs';

test('approves low-risk docs changes', () => {
  const verdict = buildPolicyVerdict({
    files: ['README.md', 'docs/runbooks/release-checklist.md'],
    labels: [],
  });

  assert.equal(verdict.decision, 'APPROVE');
  assert.equal(verdict.gate.status, 'pass');
  assert.deepEqual(verdict.riskClassification, ['risk/docs']);
  assert.ok(verdict.labels.includes('decision/approve'));
  assert.ok(verdict.specialists.includes('pr-owner-operator'));
});

test('escalates protected-path changes without human approval', () => {
  const verdict = buildPolicyVerdict({
    files: ['.github/workflows/ci.yml', 'scripts/security-audit.mjs'],
    labels: [],
  });

  assert.equal(verdict.decision, 'ESCALATE');
  assert.equal(verdict.gate.status, 'fail');
  assert.ok(verdict.riskClassification.includes('risk/infra'));
  assert.ok(verdict.riskClassification.includes('risk/security'));
  assert.ok(verdict.specialists.includes('platform-sync-auditor'));
  assert.ok(verdict.protectedPathsTouched.includes('.github/workflows/ci.yml'));
});

test('passes escalated changes after human approval label is applied', () => {
  const verdict = buildPolicyVerdict({
    files: ['packages/shared/src/index.ts'],
    labels: [HUMAN_APPROVAL_LABEL],
  });

  assert.equal(verdict.decision, 'ESCALATE');
  assert.equal(verdict.gate.status, 'pass');
  assert.ok(verdict.labels.includes(HUMAN_APPROVAL_LABEL));
  assert.ok(verdict.riskClassification.includes('risk/data-contract'));
});

test('fails when a blocking review label remains on the pull request', () => {
  const verdict = buildPolicyVerdict({
    files: ['apps/web/src/app/page.tsx'],
    labels: [CHANGES_REQUESTED_LABEL],
  });

  assert.equal(verdict.decision, 'APPROVE');
  assert.equal(verdict.gate.status, 'fail');
  assert.match(verdict.gate.reason, /blocking decision label/u);
});

test('adds conditional checks for web runtime changes', () => {
  const verdict = buildPolicyVerdict({
    files: ['apps/web/src/app/(dashboard)/page.tsx'],
    labels: [],
  });

  assert.ok(verdict.requiredChecks.includes('Synthetic Proxy Smoke'));
  assert.ok(verdict.riskClassification.includes('risk/runtime'));
  assert.ok(verdict.labels.includes('area/web'));
  assert.ok(verdict.specialists.includes('runtime-smoke-guardian'));
});
