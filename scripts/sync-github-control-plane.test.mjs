import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildManagedLabels,
  buildRepoSettingsPayload,
  buildRulesetPayload,
  CONTROL_PLANE_RULESET,
} from './lib/github-control-plane-config.mjs';

test('repo settings enable guarded auto-merge defaults', () => {
  const payload = buildRepoSettingsPayload();

  assert.equal(payload.allow_auto_merge, true);
  assert.equal(payload.delete_branch_on_merge, true);
  assert.equal(payload.allow_merge_commit, false);
  assert.equal(payload.allow_squash_merge, true);
});

test('ruleset payload protects main and release branches with stable required checks', () => {
  const payload = buildRulesetPayload({ defaultBranch: 'main' });
  const checkRule = payload.rules.find((rule) => rule.type === 'required_status_checks');

  assert.equal(payload.name, CONTROL_PLANE_RULESET);
  assert.deepEqual(payload.conditions.ref_name.include, ['refs/heads/main', 'refs/heads/release/*']);
  assert.ok(checkRule);
  assert.deepEqual(
    checkRule.parameters.required_status_checks.map((entry) => entry.context),
    [
      'Verify Commit Signatures',
      'Test Web',
      'Test Engine',
      'Test Agents',
      'Security Audit',
      'Policy Verdict',
    ],
  );
});

test('managed labels include decision, risk, area, and automation labels', () => {
  const labels = buildManagedLabels();
  const names = labels.map((label) => label.name);

  assert.ok(names.includes('risk/infra'));
  assert.ok(names.includes('area/web'));
  assert.ok(names.includes('decision/human-approved'));
  assert.ok(names.includes('automation/nightly-failure'));
});
