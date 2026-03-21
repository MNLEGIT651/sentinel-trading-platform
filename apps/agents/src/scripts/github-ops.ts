#!/usr/bin/env tsx
/**
 * github-ops.ts — Sentinel Ops Commander CLI
 *
 * Standalone script for automated GitHub repo health monitoring.
 * Uses `gh` CLI (must be authenticated) and outputs structured JSON reports.
 *
 * Usage:
 *   tsx apps/agents/src/scripts/github-ops.ts health     # Full 7-check report
 *   tsx apps/agents/src/scripts/github-ops.ts ci          # CI status only
 *   tsx apps/agents/src/scripts/github-ops.ts prs         # Open PR audit
 *   tsx apps/agents/src/scripts/github-ops.ts security    # Dependabot alerts
 *   tsx apps/agents/src/scripts/github-ops.ts stale       # Stale issues + branches
 *   tsx apps/agents/src/scripts/github-ops.ts weekly      # Full weekly audit
 *   tsx apps/agents/src/scripts/github-ops.ts report      # Post GitHub issue report
 *
 * Environment:
 *   GITHUB_REPO   — owner/repo slug (default: MNLEGIT651/sentinel-trading-platform)
 *   GITHUB_TOKEN  — PAT with repo + security_events scope (falls back to gh auth)
 */

import { execSync, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO = process.env.GITHUB_REPO ?? 'MNLEGIT651/sentinel-trading-platform';

// Thresholds (days unless noted)
const T = {
  PR_WARN_AGE: 5,
  PR_FAIL_AGE: 10,
  ISSUE_WARN_AGE: 14,
  ISSUE_FAIL_AGE: 30,
  BRANCH_WARN_AGE: 14,
  BRANCH_FAIL_AGE: 30,
  CI_FAIL_RATE_WARN: 0.15,
  CI_FAIL_RATE_FAIL: 0.30,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Rating = 'PASS' | 'WARN' | 'FAIL' | 'SKIP';

interface Check {
  name: string;
  rating: Rating;
  summary: string;
  details?: unknown;
  actions?: string[];
}

interface OpsReport {
  repo: string;
  generatedAt: string;
  mode: string;
  checks: Check[];
  overallRating: Rating;
  actionsTaken: string[];
  attentionNeeded: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gh(args: string): unknown {
  try {
    const out = execFileSync('gh', args.split(' '), {
      encoding: 'utf8',
      env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '' },
    });
    try {
      return JSON.parse(out);
    } catch {
      return out.trim();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg.slice(0, 300) };
  }
}

function ghApi(path: string, jqFilter?: string): unknown {
  const args = ['api', `/repos/${REPO}${path}`];
  if (jqFilter) args.push('--jq', jqFilter);
  return gh(args.join(' '));
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

function rate(value: number, warnThreshold: number, failThreshold: number): Rating {
  if (value >= failThreshold) return 'FAIL';
  if (value >= warnThreshold) return 'WARN';
  return 'PASS';
}

function worstRating(ratings: Rating[]): Rating {
  if (ratings.includes('FAIL')) return 'FAIL';
  if (ratings.includes('WARN')) return 'WARN';
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkCI(): Check {
  const runs = gh(
    `run list --repo ${REPO} --limit 20 --json databaseId,status,conclusion,name,createdAt,headBranch`
  ) as Array<{
    databaseId: number;
    status: string;
    conclusion: string;
    name: string;
    createdAt: string;
    headBranch: string;
  }>;

  if (!Array.isArray(runs)) {
    return { name: 'CI Health', rating: 'SKIP', summary: 'Could not fetch CI runs', details: runs };
  }

  const completed = runs.filter((r) => r.status === 'completed');
  const mainRuns = completed.filter((r) => r.headBranch === 'main').slice(0, 5);
  const mainFails = mainRuns.filter((r) => r.conclusion === 'failure');
  const failRate = completed.length > 0
    ? completed.filter((r) => r.conclusion === 'failure').length / Math.min(completed.length, 30)
    : 0;

  const actions: string[] = [];
  let rating: Rating = 'PASS';
  let summary = 'All recent runs green';

  if (mainFails.length >= 2) {
    rating = 'FAIL';
    summary = `${mainFails.length} consecutive failures on main`;
    actions.push(`Investigate run #${mainFails[0]?.databaseId} — latest main failure`);
  } else if (mainFails.length === 1) {
    rating = 'WARN';
    summary = `1 failed run on main (run #${mainFails[0]?.databaseId})`;
  } else if (failRate > T.CI_FAIL_RATE_FAIL) {
    rating = 'FAIL';
    summary = `High failure rate: ${Math.round(failRate * 100)}% of recent runs failed`;
  } else if (failRate > T.CI_FAIL_RATE_WARN) {
    rating = 'WARN';
    summary = `Elevated failure rate: ${Math.round(failRate * 100)}% of recent runs failed`;
  }

  return {
    name: 'CI Health',
    rating,
    summary,
    details: { mainFails: mainFails.length, failRate: Math.round(failRate * 100) + '%', recentRuns: completed.length },
    actions,
  };
}

function checkPRs(): Check {
  const prs = gh(
    `pr list --repo ${REPO} --json number,title,author,createdAt,reviewDecision,isDraft,headRefName`
  ) as Array<{
    number: number;
    title: string;
    author: { login: string };
    createdAt: string;
    reviewDecision: string | null;
    isDraft: boolean;
    headRefName: string;
  }>;

  if (!Array.isArray(prs)) {
    return { name: 'Open PRs', rating: 'SKIP', summary: 'Could not fetch PRs', details: prs };
  }

  const activePRs = prs.filter((p) => !p.isDraft);
  const stale = activePRs.filter((p) => daysSince(p.createdAt) >= T.PR_WARN_AGE && !p.reviewDecision);
  const critical = activePRs.filter((p) => daysSince(p.createdAt) >= T.PR_FAIL_AGE);
  const actions: string[] = [];

  stale.forEach((p) => {
    actions.push(`PR #${p.number} "${p.title}" — ${daysSince(p.createdAt)}d old, no review`);
  });

  const rating = critical.length > 0
    ? 'FAIL'
    : stale.length > 0
    ? 'WARN'
    : 'PASS';

  return {
    name: 'Open PRs',
    rating,
    summary:
      rating === 'PASS'
        ? `${activePRs.length} open PR(s), all within thresholds`
        : `${stale.length} stale PR(s) need attention`,
    details: { total: activePRs.length, stale: stale.length, critical: critical.length },
    actions,
  };
}

function checkIssues(): Check {
  const issues = gh(
    `issue list --repo ${REPO} --json number,title,labels,createdAt,updatedAt,assignees`
  ) as Array<{
    number: number;
    title: string;
    labels: Array<{ name: string }>;
    createdAt: string;
    updatedAt: string;
    assignees: Array<{ login: string }>;
  }>;

  if (!Array.isArray(issues)) {
    return { name: 'Issues Triage', rating: 'SKIP', summary: 'Could not fetch issues', details: issues };
  }

  const unlabeled = issues.filter((i) => i.labels.length === 0);
  const stale = issues.filter((i) => daysSince(i.updatedAt) >= T.ISSUE_WARN_AGE);
  const criticalStale = issues.filter((i) => daysSince(i.updatedAt) >= T.ISSUE_FAIL_AGE);
  const actions: string[] = [];

  unlabeled.slice(0, 5).forEach((i) => {
    actions.push(`Issue #${i.number} has no labels — add "triage"`);
  });
  criticalStale.slice(0, 3).forEach((i) => {
    actions.push(`Issue #${i.number} inactive for ${daysSince(i.updatedAt)}d — consider closing`);
  });

  const rating = criticalStale.length > 0 || unlabeled.length >= 5
    ? 'FAIL'
    : stale.length > 0 || unlabeled.length > 0
    ? 'WARN'
    : 'PASS';

  return {
    name: 'Issues Triage',
    rating,
    summary: rating === 'PASS'
      ? `${issues.length} open issue(s), all labeled and recent`
      : `${unlabeled.length} unlabeled, ${stale.length} stale`,
    details: { total: issues.length, unlabeled: unlabeled.length, stale: stale.length },
    actions,
  };
}

function checkSecurity(): Check {
  const alerts = ghApi('/dependabot/alerts', '[.[] | select(.state=="open") | {number, severity: .security_vulnerability.severity, package: .security_vulnerability.package.name, fix: .security_vulnerability.first_patched_version.identifier}]');

  if (typeof alerts === 'object' && alerts !== null && 'error' in alerts) {
    return {
      name: 'Security Advisories',
      rating: 'SKIP',
      summary: 'Dependabot API unavailable (check repo settings)',
      details: alerts,
    };
  }

  const alertList = Array.isArray(alerts) ? alerts as Array<{ number: number; severity: string; package: string; fix: string }> : [];
  const critical = alertList.filter((a) => a.severity === 'critical' || a.severity === 'high');
  const actions: string[] = [];

  critical.forEach((a) => {
    actions.push(`[${a.severity.toUpperCase()}] ${a.package} — upgrade to ${a.fix ?? 'latest'}`);
  });

  const rating = critical.length > 0 ? 'FAIL' : alertList.length > 0 ? 'WARN' : 'PASS';

  return {
    name: 'Security Advisories',
    rating,
    summary: alertList.length === 0
      ? 'No open Dependabot alerts'
      : `${alertList.length} alert(s) open (${critical.length} critical/high)`,
    details: { total: alertList.length, critical: critical.length },
    actions,
  };
}

function checkBranches(): Check {
  const branches = ghApi('/branches', '[.[].name]');
  const openPRBranches = gh(
    `pr list --repo ${REPO} --json headRefName`
  ) as Array<{ headRefName: string }>;

  if (!Array.isArray(branches)) {
    return { name: 'Branch Hygiene', rating: 'SKIP', summary: 'Could not fetch branches', details: branches };
  }

  const prBranchSet = new Set(
    Array.isArray(openPRBranches) ? openPRBranches.map((p) => p.headRefName) : []
  );

  const protected_names = new Set(['main', 'deploy/railway-vercel-proxy']);
  const orphans = (branches as string[]).filter(
    (b) => !protected_names.has(b) && !prBranchSet.has(b)
  );

  const rating = orphans.length >= T.BRANCH_FAIL_AGE / 3
    ? 'FAIL'
    : orphans.length > 0
    ? 'WARN'
    : 'PASS';

  return {
    name: 'Branch Hygiene',
    rating,
    summary: orphans.length === 0
      ? 'All branches have open PRs or are protected'
      : `${orphans.length} branch(es) with no open PR`,
    details: { total: (branches as string[]).length, orphaned: orphans, protected: [...protected_names] },
    actions: orphans.slice(0, 5).map((b) => `Consider deleting branch: ${b}`),
  };
}

function checkDeployments(): Check {
  const deployments = ghApi(
    '/deployments',
    '[.[0:5] | .[] | {id, env: .environment, ref: .ref, created: .created_at}]'
  );

  if (!Array.isArray(deployments)) {
    return {
      name: 'Deployment Health',
      rating: 'SKIP',
      summary: 'Could not check deployments (use Vercel MCP for web deploy status)',
      details: deployments,
    };
  }

  const recent = deployments as Array<{ id: number; env: string; ref: string; created: string }>;
  const newest = recent[0];
  const ageDays = newest ? daysSince(newest.created) : 999;

  const rating = ageDays > 7 ? 'WARN' : 'PASS';

  return {
    name: 'Deployment Health',
    rating,
    summary: newest
      ? `Last deploy ${ageDays}d ago (${newest.env}, ref: ${newest.ref})`
      : 'No deployment records found',
    details: { lastDeployAge: ageDays, recent: recent.slice(0, 3) },
    actions: ageDays > 7 ? ['No deployment in 7+ days — verify Vercel and Railway are healthy'] : [],
  };
}

// ---------------------------------------------------------------------------
// Report assembly
// ---------------------------------------------------------------------------

function buildReport(mode: string): OpsReport {
  const checks: Check[] = [];

  if (['health', 'ci', 'weekly'].includes(mode)) checks.push(checkCI());
  if (['health', 'prs', 'weekly'].includes(mode)) checks.push(checkPRs());
  if (['health', 'stale', 'weekly'].includes(mode)) checks.push(checkIssues());
  if (['health', 'security', 'weekly'].includes(mode)) checks.push(checkSecurity());
  if (['health', 'weekly'].includes(mode)) checks.push(checkDeployments());
  if (['health', 'stale', 'weekly'].includes(mode)) checks.push(checkBranches());

  const overallRating = worstRating(checks.map((c) => c.rating));
  const actionsTaken: string[] = [];
  const attentionNeeded = checks
    .filter((c) => c.rating === 'FAIL' || c.rating === 'WARN')
    .flatMap((c) => c.actions ?? []);

  return {
    repo: REPO,
    generatedAt: new Date().toISOString(),
    mode,
    checks,
    overallRating,
    actionsTaken,
    attentionNeeded,
  };
}

function formatMarkdown(report: OpsReport): string {
  const ratingIcon: Record<Rating, string> = {
    PASS: '✅',
    WARN: '⚠️',
    FAIL: '❌',
    SKIP: '⏭️',
  };

  const rows = report.checks
    .map((c) => `| ${ratingIcon[c.rating]} ${c.name} | ${c.rating} | ${c.summary} |`)
    .join('\n');

  const attention = report.attentionNeeded.length
    ? '### Items Requiring Attention\n' +
      report.attentionNeeded.map((a) => `- ${a}`).join('\n')
    : '### No items require immediate attention 🎉';

  const actions = report.actionsTaken.length
    ? '### Actions Taken\n' + report.actionsTaken.map((a) => `- ${a}`).join('\n')
    : '';

  return `## Sentinel Ops Report — ${report.generatedAt.slice(0, 10)}

**Overall:** ${ratingIcon[report.overallRating]} ${report.overallRating}
**Repo:** ${report.repo}
**Mode:** ${report.mode}

| Check | Rating | Summary |
|-------|--------|---------|
${rows}

${attention}

${actions}

---
*Auto-generated by sentinel-ops-commander*`;
}

async function postReportAsIssue(markdown: string): Promise<void> {
  const tmpFile = join(tmpdir(), `ops-report-${Date.now()}.md`);
  writeFileSync(tmpFile, markdown, 'utf8');

  const title = `[ops] Health report — ${new Date().toISOString().slice(0, 10)}`;

  try {
    execSync(
      `gh issue create --repo ${REPO} --title "${title}" --label "ops" --body-file "${tmpFile}"`,
      { stdio: 'pipe', encoding: 'utf8' }
    );
    console.log(`✅ Report posted as GitHub issue`);
  } catch (err) {
    console.error('Failed to post issue:', err);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'health';
  const validModes = ['health', 'ci', 'prs', 'security', 'stale', 'weekly', 'report'];

  if (!validModes.includes(mode)) {
    console.error(`Usage: github-ops.ts <${validModes.join('|')}>`);
    process.exit(1);
  }

  const report = buildReport(mode === 'report' ? 'health' : mode);
  const markdown = formatMarkdown(report);

  if (mode === 'report') {
    await postReportAsIssue(markdown);
  } else {
    // Print markdown for human/Claude consumption
    console.log(markdown);
    console.log('\n--- JSON ---');
    console.log(JSON.stringify(report, null, 2));
  }

  // Exit with non-zero if overall FAIL so CI/scheduler can detect it
  if (report.overallRating === 'FAIL') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('github-ops fatal error:', err);
  process.exit(2);
});
