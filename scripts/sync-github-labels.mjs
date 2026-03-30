#!/usr/bin/env node
/**
 * Sync GitHub labels to match the project's standard set.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx node scripts/sync-github-labels.mjs
 *
 * Or if gh CLI is authenticated:
 *   node scripts/sync-github-labels.mjs
 */

const REPO = 'stevenschling13/sentinel-trading-platform';

const LABELS = [
  // Type
  { name: 'bug', color: 'd73a4a', description: 'Something isn\'t working' },
  { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
  { name: 'documentation', color: '0075ca', description: 'Improvements or additions to docs' },
  { name: 'question', color: 'd876e3', description: 'Further information is requested' },
  { name: 'security', color: 'e11d48', description: 'Security vulnerability or hardening' },

  // Priority
  { name: 'priority/critical', color: 'b60205', description: 'Must fix immediately' },
  { name: 'priority/high', color: 'ff6723', description: 'Important, fix soon' },
  { name: 'priority/medium', color: 'fbca04', description: 'Fix when possible' },
  { name: 'priority/low', color: '0e8a16', description: 'Nice to have' },

  // Area
  { name: 'area/web', color: '1d76db', description: 'Next.js dashboard' },
  { name: 'area/engine', color: '5319e7', description: 'Python quant engine' },
  { name: 'area/agents', color: 'f9d0c4', description: 'Agent orchestrator' },
  { name: 'area/shared', color: 'c5def5', description: 'Shared contracts package' },
  { name: 'area/ci', color: 'bfdadc', description: 'CI/CD and GitHub Actions' },
  { name: 'area/database', color: '006b75', description: 'Supabase / migrations' },
  { name: 'area/infra', color: 'e99695', description: 'Deployment / infrastructure' },

  // Size (set by PR Size Label action)
  { name: 'size/XS', color: '3CBF00', description: '<10 lines changed' },
  { name: 'size/S', color: '5D9801', description: '<50 lines changed' },
  { name: 'size/M', color: '7F7203', description: '<200 lines changed' },
  { name: 'size/L', color: 'A14C05', description: '<500 lines changed' },
  { name: 'size/XL', color: 'C32607', description: '500+ lines changed' },

  // Status
  { name: 'dependencies', color: '0366d6', description: 'Dependency updates' },
  { name: 'discussion', color: 'cc317c', description: 'Open discussion topic' },
  { name: 'idea', color: 'fef2c0', description: 'Idea or proposal' },
  { name: 'help wanted', color: '008672', description: 'Extra attention needed' },
  { name: 'good first issue', color: '7057ff', description: 'Good for newcomers' },
  { name: 'skip-changelog', color: 'ededed', description: 'Exclude from release notes' },
  { name: 'testing', color: 'bfd4f2', description: 'Test improvements' },
  { name: 'infrastructure', color: 'd4c5f9', description: 'Build / deploy changes' },
];

async function run() {
  const { execSync } = await import('child_process');

  for (const label of LABELS) {
    try {
      execSync(
        `gh label create "${label.name}" --repo ${REPO} --color "${label.color}" --description "${label.description}" --force`,
        { stdio: 'pipe' }
      );
      console.log(`✓ ${label.name}`);
    } catch (e) {
      console.error(`✗ ${label.name}: ${e.message}`);
    }
  }

  console.log(`\nDone — ${LABELS.length} labels synced.`);
}

run();
