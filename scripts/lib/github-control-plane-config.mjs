import { BASE_REQUIRED_CHECKS, MANAGED_LABELS } from './control-plane-policy.mjs';

export const CONTROL_PLANE_RULESET = 'guarded-auto-protected-branches';

const LABEL_DEFINITIONS = {
  'risk/docs': { color: '0E8A16', description: 'Documentation-only or documentation-touching change.' },
  'risk/infra': { color: '5319E7', description: 'Infrastructure, CI/CD, or deployment control-plane change.' },
  'risk/runtime': { color: 'FBCA04', description: 'Runtime behavior change in web, engine, or agents.' },
  'risk/security': { color: 'B60205', description: 'Security-, auth-, or trust-boundary-sensitive change.' },
  'risk/data-contract': { color: '1D76DB', description: 'Shared contract, env contract, or database boundary change.' },
  'area/agents': { color: 'C2E0C6', description: 'Touches the agents service.' },
  'area/ci': { color: 'BFDADC', description: 'Touches GitHub automation or CI workflows.' },
  'area/docs': { color: 'D4C5F9', description: 'Touches repository or operational documentation.' },
  'area/engine': { color: 'F9D0C4', description: 'Touches the Python engine service.' },
  'area/security': { color: 'B60205', description: 'Touches security controls or trust files.' },
  'area/shared': { color: '006B75', description: 'Touches shared contracts or shared package code.' },
  'area/supabase': { color: '0E8A16', description: 'Touches Supabase schema, env, or auth boundaries.' },
  'area/web': { color: '5319E7', description: 'Touches the Next.js web app.' },
  'decision/approve': { color: '0E8A16', description: 'Automation classified the PR as low-risk.' },
  'decision/escalate': { color: 'B60205', description: 'Automation requires explicit human review before merge.' },
  'decision/human-approved': { color: '1D76DB', description: 'Human owner approved an escalated PR for merge.' },
  'decision/changes-requested': { color: 'D93F0B', description: 'Blocking review feedback remains unresolved.' },
  'automation/nightly-failure': { color: 'D73A4A', description: 'Automated nightly control-plane verification failed.' },
  'automation/settings-drift': { color: 'F9D0C4', description: 'GitHub settings or rules drifted from the desired policy.' },
};

export function buildRepoSettingsPayload() {
  return {
    allow_auto_merge: true,
    delete_branch_on_merge: true,
    allow_merge_commit: false,
    allow_squash_merge: true,
    allow_rebase_merge: true,
    use_squash_pr_title_as_default: true,
    squash_merge_commit_message: 'PR_BODY',
    squash_merge_commit_title: 'PR_TITLE',
  };
}

export function buildRulesetPayload({ defaultBranch = 'main' } = {}) {
  return {
    name: CONTROL_PLANE_RULESET,
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: [`refs/heads/${defaultBranch}`, 'refs/heads/release/*'],
        exclude: [],
      },
    },
    bypass_actors: [],
    rules: [
      {
        type: 'pull_request',
        parameters: {
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_approving_review_count: 0,
          required_review_thread_resolution: true,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: false,
          required_status_checks: BASE_REQUIRED_CHECKS.map((context) => ({ context })),
        },
      },
      { type: 'required_linear_history' },
      { type: 'non_fast_forward' },
    ],
  };
}

export function buildManagedLabels() {
  return MANAGED_LABELS.filter((name) => LABEL_DEFINITIONS[name]).map((name) => ({
    name,
    ...LABEL_DEFINITIONS[name],
  }));
}
