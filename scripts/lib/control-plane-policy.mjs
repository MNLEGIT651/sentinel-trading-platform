const DOC_PATTERNS = [
  'docs/**',
  '.github/**/*.md',
  '**/*.md',
  '**/*.mdx',
  'LICENSE',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
];

const AREA_RULES = {
  'area/web': ['apps/web/**'],
  'area/engine': ['apps/engine/**'],
  'area/agents': ['apps/agents/**'],
  'area/shared': ['packages/shared/**'],
  'area/supabase': ['supabase/**'],
  'area/ci': ['.github/**'],
  'area/security': [
    'scripts/security-audit.mjs',
    'scripts/check-commit-signatures.sh',
    'scripts/audit-commit-signatures.sh',
    '.github/trusted_*',
    'SECURITY.md',
  ],
  'area/docs': DOC_PATTERNS,
};

const RISK_RULES = {
  'risk/infra': [
    '.github/**',
    'docker-compose.yml',
    'railway.toml',
    'apps/web/vercel.json',
    '.devcontainer/**',
    'scripts/repo-setup-audit.sh',
    'scripts/check-required-workflows.mjs',
    'scripts/sync-github-control-plane.mjs',
  ],
  'risk/security': [
    'SECURITY.md',
    '.github/trusted_*',
    'scripts/security-audit.mjs',
    'scripts/check-commit-signatures.sh',
    'scripts/audit-commit-signatures.sh',
    'apps/web/src/**/auth*/**',
    'apps/web/src/**/csrf*.ts',
    'apps/web/src/**/proxy*.ts',
    'apps/web/src/app/api/**',
    'apps/engine/src/api/main.py',
    'apps/engine/src/config.py',
  ],
  'risk/runtime': ['apps/web/**', 'apps/engine/**', 'apps/agents/**'],
  'risk/data-contract': [
    'packages/shared/**',
    'supabase/**',
    '.env.example',
    'scripts/check-env-contract.mjs',
    'scripts/validate-railway-supabase-env.mjs',
  ],
};

const SPECIALIST_RULES = {
  'platform-sync-auditor': [
    '.github/workflows/**',
    'docs/deployment.md',
    'docs/runbooks/**',
    'apps/web/vercel.json',
    'apps/engine/railway.toml',
    'railway.toml',
    'docker-compose.yml',
  ],
  'runtime-smoke-guardian': [
    '.github/workflows/railway-deploy.yml',
    '.github/workflows/release-management.yml',
    '.github/workflows/vercel-preview-smoke.yml',
    'apps/web/**',
    'apps/engine/**',
    'apps/agents/**',
    'scripts/health-check.sh',
    'scripts/smoke-test.sh',
  ],
  'supabase-boundary-guardian': [
    'supabase/**',
    'scripts/validate-railway-supabase-env.mjs',
    'scripts/check-env-contract.mjs',
    'docs/deployment.md',
    'docs/runbooks/production.md',
    'apps/web/src/lib/supabase/**',
  ],
};

export const BASE_REQUIRED_CHECKS = [
  'Verify Commit Signatures',
  'Test Web',
  'Test Engine',
  'Test Agents',
  'Security Audit',
  'Policy Verdict',
];

const CONDITIONAL_CHECKS = [
  {
    name: 'actionlint',
    patterns: ['.github/workflows/**', 'apps/web/src/components/settings/**'],
  },
  {
    name: 'Synthetic Proxy Smoke',
    patterns: [
      'apps/web/**',
      'packages/shared/**',
      '.github/workflows/vercel-preview-smoke.yml',
      'scripts/health-check.sh',
    ],
  },
];

export const HUMAN_APPROVAL_LABEL = 'decision/human-approved';
export const CHANGES_REQUESTED_LABEL = 'decision/changes-requested';
export const MANAGED_LABELS = [
  'risk/docs',
  'risk/infra',
  'risk/runtime',
  'risk/security',
  'risk/data-contract',
  'area/agents',
  'area/ci',
  'area/docs',
  'area/engine',
  'area/security',
  'area/shared',
  'area/supabase',
  'area/web',
  'decision/approve',
  'decision/escalate',
  HUMAN_APPROVAL_LABEL,
  CHANGES_REQUESTED_LABEL,
  'automation/nightly-failure',
  'automation/settings-drift',
];

export const PROTECTED_PATH_PATTERNS = [
  '.github/workflows/**',
  '.github/CODEOWNERS',
  '.github/trusted_*',
  'package.json',
  'pnpm-lock.yaml',
  'turbo.json',
  '.env.example',
  'apps/web/vercel.json',
  'packages/shared/src/**',
  'supabase/**',
  'apps/engine/src/api/main.py',
  'apps/engine/src/config.py',
  'railway.toml',
  'docker-compose.yml',
];

export function normalizeFiles(files) {
  return [...new Set(files.map((file) => file.replace(/\\/g, '/').replace(/^\.?\//u, '')).filter(Boolean))].sort();
}

export function buildPolicyVerdict({ files, labels = [], actor = 'unknown' }) {
  const normalizedFiles = normalizeFiles(files);
  const currentLabels = new Set(labels);
  const areas = collectLabels(normalizedFiles, AREA_RULES);
  const docsOnly = normalizedFiles.length > 0 && normalizedFiles.every((file) => matchesAny(file, DOC_PATTERNS));
  const risks = collectRisks(normalizedFiles, docsOnly);
  const specialists = collectSpecialists(normalizedFiles);
  const protectedPathsTouched = normalizedFiles.filter((file) => matchesAny(file, PROTECTED_PATH_PATTERNS));
  const optionalChecks = CONDITIONAL_CHECKS.filter(({ patterns }) =>
    normalizedFiles.some((file) => matchesAny(file, patterns)),
  ).map(({ name }) => name);
  const requiredChecks = [...BASE_REQUIRED_CHECKS, ...optionalChecks].filter(uniqueValue);
  const humanApproved = currentLabels.has(HUMAN_APPROVAL_LABEL);
  const changesRequested = currentLabels.has(CHANGES_REQUESTED_LABEL);
  const decision = protectedPathsTouched.length > 0 ? 'ESCALATE' : 'APPROVE';
  const remediationPriorities = [];

  if (protectedPathsTouched.length > 0) {
    remediationPriorities.push(
      `P0: human review required for protected paths (${protectedPathsTouched.join(', ')}) before merge.`,
    );
  }

  if (changesRequested) {
    remediationPriorities.push('P0: remove `decision/changes-requested` after the blocking review is resolved.');
  }

  if (actor === 'dependabot[bot]' && protectedPathsTouched.length > 0) {
    remediationPriorities.push('P1: keep Dependabot PR out of auto-merge for protected-path updates.');
  }

  const managedLabels = [
    ...areas,
    ...risks,
    decision === 'ESCALATE' ? 'decision/escalate' : 'decision/approve',
  ]
    .filter(uniqueValue)
    .sort();

  if (humanApproved) {
    managedLabels.push(HUMAN_APPROVAL_LABEL);
  }

  if (changesRequested) {
    managedLabels.push(CHANGES_REQUESTED_LABEL);
  }

  const gate = buildGate({ decision, humanApproved, changesRequested, protectedPathsTouched });

  return {
    actor,
    files: normalizedFiles,
    areas,
    riskClassification: risks,
    specialists,
    protectedPathsTouched,
    requiredChecks,
    labels: [...new Set(managedLabels)].sort(),
    decision,
    remediationPriorities,
    gate,
  };
}

export function renderPolicySummary(verdict) {
  const lines = [
    '## Policy Verdict',
    '',
    `- Decision: \`${verdict.decision}\``,
    `- Gate: \`${verdict.gate.status.toUpperCase()}\``,
    `- Risks: ${renderList(verdict.riskClassification)}`,
    `- Areas: ${renderList(verdict.areas)}`,
    `- Specialists: ${renderList(verdict.specialists)}`,
    `- Required checks: ${renderList(verdict.requiredChecks)}`,
    `- Protected paths: ${renderList(verdict.protectedPathsTouched)}`,
    `- Labels: ${renderList(verdict.labels)}`,
  ];

  if (verdict.remediationPriorities.length > 0) {
    lines.push('', '### Remediation priorities', '', ...verdict.remediationPriorities.map((item) => `- ${item}`));
  }

  if (verdict.gate.reason) {
    lines.push('', '### Gate reason', '', `- ${verdict.gate.reason}`);
  }

  return `${lines.join('\n')}\n`;
}

export function isManagedLabel(name) {
  return MANAGED_LABELS.includes(name);
}

function buildGate({ decision, humanApproved, changesRequested, protectedPathsTouched }) {
  if (changesRequested) {
    return {
      status: 'fail',
      reason: 'A blocking decision label is present on the pull request.',
    };
  }

  if (decision === 'ESCALATE' && !humanApproved) {
    return {
      status: 'fail',
      reason: `Protected paths changed (${protectedPathsTouched.join(', ')}). Apply \`${HUMAN_APPROVAL_LABEL}\` after review.`,
    };
  }

  return {
    status: 'pass',
    reason: humanApproved ? `Human approval recorded with \`${HUMAN_APPROVAL_LABEL}\`.` : 'Low-risk change set.',
  };
}

function collectLabels(files, rules) {
  return Object.entries(rules)
    .filter(([, patterns]) => files.some((file) => matchesAny(file, patterns)))
    .map(([label]) => label)
    .sort();
}

function collectRisks(files, docsOnly) {
  const risks = collectLabels(files, RISK_RULES);

  if (docsOnly || risks.length === 0) {
    risks.push('risk/docs');
  } else if (files.some((file) => matchesAny(file, DOC_PATTERNS))) {
    risks.push('risk/docs');
  }

  return [...new Set(risks)].sort();
}

function collectSpecialists(files) {
  return ['pr-owner-operator', ...collectLabels(files, SPECIALIST_RULES)].filter(uniqueValue).sort();
}

function renderList(items) {
  return items.length > 0 ? items.map((item) => `\`${item}\``).join(', ') : '_none_';
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => globMatch(file, pattern));
}

function globMatch(file, pattern) {
  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${source}$`, 'u').test(file);
}

function uniqueValue(value, index, array) {
  return array.indexOf(value) === index;
}
