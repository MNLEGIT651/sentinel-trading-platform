/**
 * GitHub Client — reusable helpers for GitHub API access via `gh` CLI.
 *
 * Extracted from `scripts/github-ops.ts` so the PR Manager and Workflow Manager
 * agents can query GitHub without duplicating shell-exec plumbing.
 */

import { execFileSync } from 'node:child_process';
import { GITHUB_REPO, OPS_THRESHOLDS } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Rating = 'PASS' | 'WARN' | 'FAIL' | 'SKIP';

export interface PRSummary {
  number: number;
  title: string;
  author: string;
  createdAt: string;
  reviewDecision: string | null;
  isDraft: boolean;
  headRefName: string;
  ageDays: number;
}

export interface WorkflowRunSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  branch: string;
  createdAt: string;
  ageDays: number;
}

export interface WorkflowSummary {
  id: number;
  name: string;
  path: string;
  state: string;
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

export function gh(args: string[]): unknown {
  try {
    const out = execFileSync('gh', args, {
      encoding: 'utf8',
      env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '' },
      timeout: 30_000,
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

export function ghApi(path: string, repo?: string): unknown {
  const slug = repo ?? GITHUB_REPO;
  return gh(['api', `/repos/${slug}${path}`]);
}

export function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

export function rate(value: number, warnThreshold: number, failThreshold: number): Rating {
  if (value >= failThreshold) return 'FAIL';
  if (value >= warnThreshold) return 'WARN';
  return 'PASS';
}

// ---------------------------------------------------------------------------
// PR queries
// ---------------------------------------------------------------------------

export function listOpenPRs(repo?: string): PRSummary[] {
  const slug = repo ?? GITHUB_REPO;
  const raw = gh([
    'pr',
    'list',
    '--repo',
    slug,
    '--json',
    'number,title,author,createdAt,reviewDecision,isDraft,headRefName',
  ]);

  if (!Array.isArray(raw)) return [];

  return (
    raw as Array<{
      number: number;
      title: string;
      author: { login: string };
      createdAt: string;
      reviewDecision: string | null;
      isDraft: boolean;
      headRefName: string;
    }>
  ).map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.author.login,
    createdAt: pr.createdAt,
    reviewDecision: pr.reviewDecision,
    isDraft: pr.isDraft,
    headRefName: pr.headRefName,
    ageDays: daysSince(pr.createdAt),
  }));
}

export function getPRDetails(prNumber: number, repo?: string): unknown {
  const slug = repo ?? GITHUB_REPO;
  return gh([
    'pr',
    'view',
    String(prNumber),
    '--repo',
    slug,
    '--json',
    'number,title,body,author,createdAt,reviewDecision,isDraft,headRefName,mergeable,reviewRequests,statusCheckRollup,additions,deletions,changedFiles',
  ]);
}

export function getPRChecks(prNumber: number, repo?: string): unknown {
  const slug = repo ?? GITHUB_REPO;
  return gh(['pr', 'checks', String(prNumber), '--repo', slug, '--json', 'name,state,description']);
}

export function auditPRs(repo?: string): {
  rating: Rating;
  summary: string;
  prs: PRSummary[];
  stale: PRSummary[];
  critical: PRSummary[];
} {
  const prs = listOpenPRs(repo);
  const activePRs = prs.filter((p) => !p.isDraft);
  const stale = activePRs.filter(
    (p) => p.ageDays >= OPS_THRESHOLDS.PR_WARN_AGE_DAYS && !p.reviewDecision,
  );
  const critical = activePRs.filter((p) => p.ageDays >= OPS_THRESHOLDS.PR_FAIL_AGE_DAYS);
  const rating: Rating = critical.length > 0 ? 'FAIL' : stale.length > 0 ? 'WARN' : 'PASS';
  const summary =
    rating === 'PASS'
      ? `${activePRs.length} open PR(s), all within thresholds`
      : `${stale.length} stale PR(s) need attention`;

  return { rating, summary, prs: activePRs, stale, critical };
}

// ---------------------------------------------------------------------------
// Workflow / CI queries
// ---------------------------------------------------------------------------

export function listWorkflows(repo?: string): WorkflowSummary[] {
  const slug = repo ?? GITHUB_REPO;
  const raw = ghApi('/actions/workflows', slug);
  if (typeof raw !== 'object' || raw === null || !('workflows' in raw)) return [];
  const workflows = (
    raw as { workflows: Array<{ id: number; name: string; path: string; state: string }> }
  ).workflows;
  return workflows.map((w) => ({
    id: w.id,
    name: w.name,
    path: w.path,
    state: w.state,
  }));
}

export function listWorkflowRuns(limit = 20, repo?: string): WorkflowRunSummary[] {
  const slug = repo ?? GITHUB_REPO;
  const raw = gh([
    'run',
    'list',
    '--repo',
    slug,
    '--limit',
    String(limit),
    '--json',
    'databaseId,status,conclusion,name,createdAt,headBranch',
  ]);

  if (!Array.isArray(raw)) return [];

  return (
    raw as Array<{
      databaseId: number;
      status: string;
      conclusion: string;
      name: string;
      createdAt: string;
      headBranch: string;
    }>
  ).map((r) => ({
    id: r.databaseId,
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    branch: r.headBranch,
    createdAt: r.createdAt,
    ageDays: daysSince(r.createdAt),
  }));
}

export function getWorkflowRunLogs(runId: number, repo?: string): unknown {
  const slug = repo ?? GITHUB_REPO;
  return gh(['run', 'view', String(runId), '--repo', slug, '--log-failed']);
}

export function auditCI(repo?: string): {
  rating: Rating;
  summary: string;
  runs: WorkflowRunSummary[];
  mainFailCount: number;
  failRate: number;
} {
  const runs = listWorkflowRuns(20, repo);
  const completed = runs.filter((r) => r.status === 'completed');
  const mainRuns = completed.filter((r) => r.branch === 'main').slice(0, 5);
  const mainFails = mainRuns.filter((r) => r.conclusion === 'failure');
  const failRate =
    completed.length > 0
      ? completed.filter((r) => r.conclusion === 'failure').length / Math.min(completed.length, 30)
      : 0;

  let rating: Rating = 'PASS';
  let summary = 'All recent runs green';

  if (mainFails.length >= 2) {
    rating = 'FAIL';
    summary = `${mainFails.length} consecutive failures on main`;
  } else if (mainFails.length === 1) {
    rating = 'WARN';
    summary = `1 failed run on main (run #${mainFails[0]?.id})`;
  } else if (failRate > OPS_THRESHOLDS.CI_FAIL_RATE_FAIL) {
    rating = 'FAIL';
    summary = `High failure rate: ${Math.round(failRate * 100)}% of recent runs failed`;
  } else if (failRate > OPS_THRESHOLDS.CI_FAIL_RATE_WARN) {
    rating = 'WARN';
    summary = `Elevated failure rate: ${Math.round(failRate * 100)}% of recent runs failed`;
  }

  return { rating, summary, runs: completed, mainFailCount: mainFails.length, failRate };
}
