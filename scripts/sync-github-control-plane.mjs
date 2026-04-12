import { spawnSync } from 'node:child_process';

import {
  buildManagedLabels,
  buildRepoSettingsPayload,
  buildRulesetPayload,
  CONTROL_PLANE_RULESET,
} from './lib/github-control-plane-config.mjs';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const repo = args.repo ?? process.env.GITHUB_REPOSITORY ?? 'stevenschling13/Trading-App';
const defaultBranch = args.defaultBranch ?? 'main';
const mode = args.apply ? 'apply' : 'dry-run';

console.log(`Syncing GitHub control plane for ${repo} (${mode})`);

const repoSettings = buildRepoSettingsPayload();
const rulesetPayload = buildRulesetPayload({ defaultBranch });
const labels = buildManagedLabels();

if (!args.apply) {
  console.log(JSON.stringify({ repo, repoSettings, rulesetPayload, labels }, null, 2));
  process.exit(0);
}

patchRepo(repo, repoSettings);
enableSecurityFeature(repo, 'vulnerability-alerts');
enableSecurityFeature(repo, 'automated-security-fixes');
syncLabels(repo, labels);
syncRuleset(repo, rulesetPayload);

console.log('GitHub control plane sync complete.');

function parseArgs(argv) {
  const parsed = {
    apply: false,
    help: false,
    repo: null,
    defaultBranch: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case '--apply':
        parsed.apply = true;
        break;
      case '--repo':
        parsed.repo = argv[index + 1] ?? null;
        index += 1;
        break;
      case '--default-branch':
        parsed.defaultBranch = argv[index + 1] ?? null;
        index += 1;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/sync-github-control-plane.mjs [--apply] [--repo owner/name] [--default-branch main]

Without --apply the script prints the desired repo settings, labels, and ruleset payload.`);
}

function patchRepo(repo, payload) {
  ghJson(repo, `repos/${repo}`, 'PATCH', payload);
}

function enableSecurityFeature(repo, feature) {
  ghRequest(repo, `repos/${repo}/${feature}`, 'PUT');
}

function syncLabels(repo, labels) {
  for (const label of labels) {
    try {
      ghJson(repo, `repos/${repo}/labels/${encodeURIComponent(label.name)}`, 'PATCH', {
        new_name: label.name,
        color: label.color,
        description: label.description,
      });
    } catch {
      ghJson(repo, `repos/${repo}/labels`, 'POST', label);
    }
  }
}

function syncRuleset(repo, payload) {
  const existingRulesets = ghJson(repo, `repos/${repo}/rulesets`, 'GET');
  const existing = Array.isArray(existingRulesets)
    ? existingRulesets.find((ruleset) => ruleset.name === CONTROL_PLANE_RULESET)
    : null;

  if (existing) {
    ghJson(repo, `repos/${repo}/rulesets/${existing.id}`, 'PUT', payload);
    return;
  }

  ghJson(repo, `repos/${repo}/rulesets`, 'POST', payload);
}

function ghJson(repo, endpoint, method, payload) {
  const args = ['api', endpoint, '--method', method];
  const input = payload ? JSON.stringify(payload) : undefined;

  if (payload) {
    args.push('--input', '-');
  }

  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    input,
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `gh api ${endpoint} failed for ${repo}`);
  }

  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function ghRequest(repo, endpoint, method) {
  const result = spawnSync('gh', ['api', endpoint, '--method', method], {
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    const stderr = result.stderr || result.stdout || '';
    if (stderr.includes('404')) {
      return;
    }
    throw new Error(stderr || `gh api ${endpoint} failed for ${repo}`);
  }
}
