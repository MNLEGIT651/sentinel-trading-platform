#!/usr/bin/env node
/**
 * PR Guardian — Automated pull-request quality gate for AI-agent workflows.
 *
 * Checks every PR for:
 *   1. Scope creep (file count, line churn)
 *   2. Branch staleness (commits behind main)
 *   3. File health (individual file length)
 *   4. Overlap with other open PRs
 *   5. High-risk path changes
 *   6. Import validity (catches hallucinated modules)
 *   7. Single-concern enforcement (directory spread)
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks failed (should block merge)
 *   2 — warnings only (advisory, does not block)
 *
 * Usage:
 *   node scripts/pr-guardian.mjs                    # auto-detect from GITHUB_EVENT_PATH
 *   node scripts/pr-guardian.mjs --pr 42            # explicit PR number
 *   node scripts/pr-guardian.mjs --local            # local mode (no GitHub API)
 *   node scripts/pr-guardian.mjs --dry-run          # print report, exit 0 always
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Configuration — tune thresholds here
// ---------------------------------------------------------------------------
const CONFIG = {
  scope: {
    filesWarn: 20,
    filesFail: 30,
    linesWarn: 800,
    linesFail: 1500,
  },
  staleness: {
    commitsWarn: 5,
    commitsFail: 15,
    // Staleness only fails when combined with high-risk or overlapping files
    failOnlyWithRisk: true,
  },
  fileHealth: {
    linesWarn: 400,
    linesFail: 500,
    // Delta-based: only fail if PR grows an already-large file by this many lines
    growthThreshold: 50,
    // Files excluded from health checks (generated, lock, etc.)
    excludePatterns: ['database.types.ts', '*.lock', '*.snap', 'pnpm-lock.yaml'],
  },
  overlap: {
    filesWarn: 3,
    filesFail: 8,
    // Only hard-fail overlap on high-risk paths
    failOnlyHighRisk: true,
  },
  spread: {
    dirsWarn: 4,
    dirsFail: 7,
  },
  highRiskPaths: [
    '.github/workflows/',
    'packages/shared/src/',
    'supabase/migrations/',
    'apps/web/src/lib/engine-fetch.ts',
    'apps/web/src/lib/engine-client.ts',
    'apps/web/src/middleware.ts',
    'apps/engine/src/api/main.py',
    'apps/engine/src/config.py',
    'apps/agents/src/server.ts',
  ],
  ignoredFiles: [
    'pnpm-lock.yaml',
    'package-lock.json',
    '*.snap',
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a shell command and return trimmed stdout, or null on failure. */
function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/** Count total lines in a file. Returns 0 if file doesn't exist. */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/** Check if a path matches any ignore pattern. */
function isIgnored(filePath) {
  return CONFIG.ignoredFiles.some((pattern) => {
    if (pattern.startsWith('*')) return filePath.endsWith(pattern.slice(1));
    return filePath === pattern;
  });
}

/** Classify a check result. */
function classify(value, warnThreshold, failThreshold) {
  if (value >= failThreshold) return 'fail';
  if (value >= warnThreshold) return 'warn';
  return 'pass';
}

/** Emoji for status. */
function statusIcon(status) {
  if (status === 'pass') return '✅';
  if (status === 'warn') return '⚠️';
  return '❌';
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const GITHUB_API = 'https://api.github.com';

async function ghFetch(urlPath) {
  const url = urlPath.startsWith('http') ? urlPath : `${GITHUB_API}${urlPath}`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'pr-guardian' };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res.json();
}

/** Fetch all pages of a paginated GitHub endpoint. */
async function ghFetchAll(urlPath, maxPages = 5) {
  const results = [];
  let page = 1;
  while (page <= maxPages) {
    const sep = urlPath.includes('?') ? '&' : '?';
    const data = await ghFetch(`${urlPath}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Detect context
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { pr: null, local: false, dryRun: false, repo: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pr' && args[i + 1]) opts.pr = parseInt(args[i + 1], 10);
    if (args[i] === '--local') opts.local = true;
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--repo' && args[i + 1]) opts.repo = args[i + 1];
  }

  // Auto-detect from GitHub Actions event
  if (!opts.pr && process.env.GITHUB_EVENT_PATH) {
    try {
      const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      if (event.pull_request?.number) opts.pr = event.pull_request.number;
    } catch { /* ignore */ }
  }

  if (!opts.repo) {
    opts.repo = process.env.GITHUB_REPOSITORY || detectRepoFromGit();
  }

  return opts;
}

function detectRepoFromGit() {
  const url = sh('git remote get-url origin');
  if (!url) return null;
  const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match?.[1] || null;
}

// ---------------------------------------------------------------------------
// Check implementations
// ---------------------------------------------------------------------------

/**
 * Check 1: Scope — how many files and lines does this PR touch?
 */
function checkScope(changedFiles) {
  const files = changedFiles.filter((f) => !isIgnored(f.filename));
  const fileCount = files.length;
  const linesChanged = files.reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0);

  const fileStatus = classify(fileCount, CONFIG.scope.filesWarn, CONFIG.scope.filesFail);
  const lineStatus = classify(linesChanged, CONFIG.scope.linesWarn, CONFIG.scope.linesFail);
  const overall = fileStatus === 'fail' || lineStatus === 'fail' ? 'fail'
    : fileStatus === 'warn' || lineStatus === 'warn' ? 'warn' : 'pass';

  return {
    name: 'Scope',
    status: overall,
    details: `${fileCount} files changed, ${linesChanged} lines churned`,
    breakdown: [
      `Files: ${fileCount} (warn >${CONFIG.scope.filesWarn}, fail >${CONFIG.scope.filesFail}) → ${statusIcon(fileStatus)}`,
      `Lines: ${linesChanged} (warn >${CONFIG.scope.linesWarn}, fail >${CONFIG.scope.linesFail}) → ${statusIcon(lineStatus)}`,
    ],
  };
}

/**
 * Check 2: Staleness — how far behind main is this branch?
 * Only hard-fails when combined with high-risk path changes (set via riskContext).
 */
function checkStaleness(commitsBehind, touchesHighRisk = false) {
  let status = classify(commitsBehind, CONFIG.staleness.commitsWarn, CONFIG.staleness.commitsFail);

  // Downgrade fail → warn if no high-risk context
  if (status === 'fail' && CONFIG.staleness.failOnlyWithRisk && !touchesHighRisk) {
    status = 'warn';
  }

  return {
    name: 'Staleness',
    status,
    details: `${commitsBehind} commits behind main${touchesHighRisk ? ' (touches high-risk paths)' : ''}`,
    breakdown: [
      `Behind: ${commitsBehind} (warn >${CONFIG.staleness.commitsWarn}, fail >${CONFIG.staleness.commitsFail}) → ${statusIcon(status)}`,
      touchesHighRisk ? '⚡ Combined with high-risk path changes — strict enforcement' : '',
    ].filter(Boolean),
  };
}

/**
 * Check 3: File health — delta-based enforcement.
 * - Warn if a touched file is already above the warn threshold.
 * - Fail only if a PR *creates* a file above the fail threshold, or *grows*
 *   an already-large file by more than the growth threshold.
 */
function checkFileHealth(changedFiles, repoRoot) {
  const violations = [];
  const excludePatterns = CONFIG.fileHealth.excludePatterns || [];

  function isExcluded(filename) {
    return excludePatterns.some((p) => {
      if (p.startsWith('*')) return filename.endsWith(p.slice(1));
      return filename.endsWith(p);
    });
  }

  for (const f of changedFiles) {
    if (isIgnored(f.filename) || isExcluded(f.filename)) continue;
    if (f.status === 'removed') continue;

    const fullPath = path.resolve(repoRoot, f.filename);
    const currentLines = countLines(fullPath);

    if (currentLines < CONFIG.fileHealth.linesWarn) continue;

    const netAdded = (f.additions || 0) - (f.deletions || 0);
    const isNew = f.status === 'added';
    const grewSignificantly = netAdded > CONFIG.fileHealth.growthThreshold;

    let status;
    if (isNew && currentLines >= CONFIG.fileHealth.linesFail) {
      status = 'fail'; // New file created above fail threshold
    } else if (currentLines >= CONFIG.fileHealth.linesFail && grewSignificantly) {
      status = 'fail'; // Grew an already-large file significantly
    } else {
      status = 'warn'; // File is large but PR didn't make it worse
    }

    const reason = isNew ? 'new file' : grewSignificantly ? `+${netAdded} net lines` : 'pre-existing size';
    violations.push({ file: f.filename, lines: currentLines, status, reason });
  }

  const overall = violations.some((v) => v.status === 'fail') ? 'fail'
    : violations.length > 0 ? 'warn' : 'pass';

  return {
    name: 'File Health',
    status: overall,
    details: violations.length === 0
      ? 'All changed files within line limits'
      : `${violations.length} file(s) flagged for size`,
    breakdown: violations.map(
      (v) => `${v.file}: ${v.lines} lines (${v.reason}) → ${statusIcon(v.status)}`,
    ),
  };
}

/**
 * Check 4: Overlap — do other open PRs touch the same files?
 */
async function checkOverlap(prNumber, changedFileNames, repo) {
  if (!repo || !GITHUB_TOKEN) {
    return {
      name: 'Overlap',
      status: 'pass',
      details: 'Skipped (no GitHub API access)',
      breakdown: [],
    };
  }

  const openPRs = await ghFetchAll(`/repos/${repo}/pulls?state=open`);
  const otherPRs = openPRs.filter((pr) => pr.number !== prNumber);

  const overlaps = [];

  for (const other of otherPRs) {
    const otherFiles = await ghFetchAll(`/repos/${repo}/pulls/${other.number}/files`);
    const otherFileNames = new Set(otherFiles.map((f) => f.filename));
    const shared = changedFileNames.filter((f) => otherFileNames.has(f));

    if (shared.length > 0) {
      overlaps.push({
        pr: other.number,
        title: other.title,
        sharedFiles: shared,
        count: shared.length,
      });
    }
  }

  const maxOverlap = Math.max(0, ...overlaps.map((o) => o.count));

  // Only hard-fail if overlap includes high-risk paths
  let status;
  if (CONFIG.overlap.failOnlyHighRisk) {
    const hasHighRiskOverlap = overlaps.some((o) =>
      o.sharedFiles.some((f) =>
        CONFIG.highRiskPaths.some((rp) => rp.endsWith('/') ? f.startsWith(rp) : f === rp),
      ),
    );
    status = hasHighRiskOverlap && maxOverlap >= CONFIG.overlap.filesFail ? 'fail'
      : maxOverlap >= CONFIG.overlap.filesWarn ? 'warn' : 'pass';
  } else {
    status = classify(maxOverlap, CONFIG.overlap.filesWarn, CONFIG.overlap.filesFail);
  }

  return {
    name: 'Overlap',
    status,
    details: overlaps.length === 0
      ? 'No file overlap with other open PRs'
      : `Overlaps with ${overlaps.length} other PR(s)`,
    breakdown: overlaps.map(
      (o) => `PR #${o.pr} ("${o.title}"): ${o.count} shared files → ${statusIcon(classify(o.count, CONFIG.overlap.filesWarn, CONFIG.overlap.filesFail))}`,
    ),
    overlaps,
  };
}

/**
 * Check 5: High-risk paths — does this PR touch sensitive areas?
 */
function checkHighRiskPaths(changedFileNames) {
  const hits = [];

  for (const file of changedFileNames) {
    for (const riskPath of CONFIG.highRiskPaths) {
      if (riskPath.endsWith('/') ? file.startsWith(riskPath) : file === riskPath) {
        hits.push({ file, pattern: riskPath });
        break;
      }
    }
  }

  // High-risk paths are always a warning, fail only if >5 risk hits
  const status = hits.length === 0 ? 'pass' : hits.length > 5 ? 'fail' : 'warn';

  return {
    name: 'High-Risk Paths',
    status,
    details: hits.length === 0
      ? 'No high-risk paths touched'
      : `${hits.length} high-risk file(s) modified — requires careful review`,
    breakdown: hits.map((h) => `${h.file} (matches \`${h.pattern}\`)`),
  };
}

/**
 * Check 6: Import validation — catch hallucinated imports in changed files.
 * Only checks relative/workspace imports, not node_modules packages.
 */
function checkImports(changedFiles, repoRoot) {
  const errors = [];

  for (const f of changedFiles) {
    if (f.status === 'removed') continue;
    const fullPath = path.resolve(repoRoot, f.filename);
    if (!fs.existsSync(fullPath)) continue;

    const ext = path.extname(f.filename);
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
      errors.push(...checkTsImports(fullPath, f.filename, repoRoot));
    } else if (ext === '.py') {
      errors.push(...checkPyImports(fullPath, f.filename, repoRoot));
    }
  }

  // Import checks are advisory-only — compiler-backed tsc/pyright catch symbol-level issues
  const status = errors.length > 0 ? 'warn' : 'pass';

  return {
    name: 'Import Validation',
    status,
    details: errors.length === 0
      ? 'All relative/workspace imports resolve'
      : `${errors.length} unresolved import(s) — possible hallucination (advisory)`,
    breakdown: errors.map((e) => `${e.file}:${e.line} — \`${e.specifier}\` not found`),
  };
}

/** Check TypeScript/JavaScript relative imports. */
function checkTsImports(fullPath, relPath, repoRoot) {
  const errors = [];
  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return errors;
  }

  const importRegex = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/g;
  const dynamicImport = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const regex of [importRegex, dynamicImport]) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(line)) !== null) {
        const specifier = match[1];
        if (!isRelativeOrWorkspace(specifier)) continue;
        if (!resolveImport(specifier, fullPath, repoRoot)) {
          errors.push({ file: relPath, line: i + 1, specifier });
        }
      }
    }
  }
  return errors;
}

/** Check Python relative imports. */
function checkPyImports(fullPath, relPath, repoRoot) {
  const errors = [];
  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return errors;
  }

  const lines = content.split('\n');
  const fromImportRegex = /^from\s+(\.+\w[\w.]*)\s+import/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = fromImportRegex.exec(line);
    if (!match) continue;

    const specifier = match[1];
    if (!resolvePyImport(specifier, fullPath, repoRoot)) {
      errors.push({ file: relPath, line: i + 1, specifier });
    }
  }
  return errors;
}

function isRelativeOrWorkspace(specifier) {
  return specifier.startsWith('.') || specifier.startsWith('@sentinel/');
}

/** Try to resolve a TS/JS import specifier to a real file. */
function resolveImport(specifier, fromFile, repoRoot) {
  // Workspace import (@sentinel/shared)
  if (specifier.startsWith('@sentinel/')) {
    const parts = specifier.replace('@sentinel/', '').split('/');
    const pkgName = parts[0];
    const subPath = parts.slice(1).join('/');
    const pkgDir = path.resolve(repoRoot, 'packages', pkgName);
    if (!fs.existsSync(pkgDir)) return false;
    if (!subPath) return true; // Just importing the package
    // Check src/ for the subpath
    const srcDir = path.resolve(pkgDir, 'src');
    return tryResolveFile(path.resolve(srcDir, subPath));
  }

  // Relative import
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, specifier);
  return tryResolveFile(resolved);
}

/** Try common TypeScript file extensions. */
function tryResolveFile(basePath) {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js'];
  return extensions.some((ext) => fs.existsSync(basePath + ext));
}

/** Try to resolve a Python relative import. */
function resolvePyImport(specifier, fromFile, repoRoot) {
  const dots = specifier.match(/^(\.+)/)?.[1].length || 0;
  const modulePath = specifier.slice(dots).replace(/\./g, '/');

  let baseDir = path.dirname(fromFile);
  for (let i = 1; i < dots; i++) {
    baseDir = path.dirname(baseDir);
  }

  const asFile = path.resolve(baseDir, modulePath + '.py');
  const asDir = path.resolve(baseDir, modulePath, '__init__.py');
  const asPackage = path.resolve(baseDir, modulePath);

  return fs.existsSync(asFile) || fs.existsSync(asDir) || fs.existsSync(asPackage);
}

/**
 * Check 7: Single-concern — does this PR span too many top-level directories?
 */
function checkSpread(changedFileNames) {
  const topDirs = new Set();
  for (const f of changedFileNames) {
    if (isIgnored(f)) continue;
    const parts = f.split('/');
    if (parts.length <= 1) {
      topDirs.add('(root)');
    } else if (parts[0] === 'apps' || parts[0] === 'packages') {
      // Monorepo workspaces: group at 2-level depth (apps/web, packages/shared)
      topDirs.add(parts.slice(0, 2).join('/'));
    } else {
      // Everything else: group at 1-level depth (.github, scripts, docs, supabase)
      topDirs.add(parts[0]);
    }
  }

  const count = topDirs.size;
  const status = classify(count, CONFIG.spread.dirsWarn, CONFIG.spread.dirsFail);

  return {
    name: 'Single-Concern',
    status,
    details: `Touches ${count} workspace area(s)`,
    breakdown: [
      `Areas: ${[...topDirs].join(', ')}`,
      `Count: ${count} (warn >${CONFIG.spread.dirsWarn}, fail >${CONFIG.spread.dirsFail}) → ${statusIcon(status)}`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function formatReport(checks, prMeta) {
  const lines = [];
  lines.push('## 🛡️ PR Guardian Report');
  lines.push('');

  if (prMeta) {
    lines.push(`**PR #${prMeta.number}**: ${prMeta.title}`);
    lines.push(`**Branch**: \`${prMeta.head}\` → \`${prMeta.base}\``);
    lines.push(`**Author**: ${prMeta.author}`);
    lines.push('');
  }

  // Summary table
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const overall = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';
  const overallIcon = hasFail ? '❌' : hasWarn ? '⚠️' : '✅';

  lines.push(`### ${overallIcon} Overall: **${overall}**`);
  lines.push('');
  lines.push('| Check | Status | Details |');
  lines.push('|-------|--------|---------|');

  for (const check of checks) {
    lines.push(`| ${check.name} | ${statusIcon(check.status)} ${check.status.toUpperCase()} | ${check.details} |`);
  }

  lines.push('');

  // Detailed breakdown for non-pass checks
  const nonPass = checks.filter((c) => c.status !== 'pass' && c.breakdown.length > 0);
  if (nonPass.length > 0) {
    lines.push('### Details');
    lines.push('');
    for (const check of nonPass) {
      lines.push(`#### ${statusIcon(check.status)} ${check.name}`);
      for (const b of check.breakdown) {
        lines.push(`- ${b}`);
      }
      lines.push('');
    }
  }

  // Actionable guidance
  if (hasFail) {
    lines.push('### 🚫 Action Required');
    lines.push('');
    lines.push('This PR has **failing checks** that must be resolved before merge:');
    lines.push('');
    for (const check of checks.filter((c) => c.status === 'fail')) {
      if (check.name === 'Scope') {
        lines.push('- **Scope**: Split this PR into smaller, focused PRs (aim for <25 files per PR).');
      } else if (check.name === 'Staleness') {
        lines.push('- **Staleness**: Rebase onto current `main` (`git rebase origin/main`).');
      } else if (check.name === 'File Health') {
        lines.push('- **File Health**: Decompose oversized files before adding more code.');
      } else if (check.name === 'Overlap') {
        lines.push('- **Overlap**: Coordinate with other open PRs to avoid merge conflicts. Consider closing duplicates.');
      } else if (check.name === 'Import Validation') {
        lines.push('- **Imports**: Fix unresolved imports — these may be hallucinated by an AI agent.');
      } else if (check.name === 'Single-Concern') {
        lines.push('- **Single-Concern**: This PR spans too many areas. Split by workspace/concern.');
      } else if (check.name === 'High-Risk Paths') {
        lines.push('- **High-Risk**: Many sensitive files modified. Add `guardian:acknowledged` label after human review.');
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by [PR Guardian](scripts/pr-guardian.mjs) • Thresholds are configurable*');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Post comment to GitHub PR
// ---------------------------------------------------------------------------

async function postComment(repo, prNumber, body) {
  if (!GITHUB_TOKEN || !repo) return;

  const url = `${GITHUB_API}/repos/${repo}/issues/${prNumber}/comments`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'User-Agent': 'pr-guardian',
    'Content-Type': 'application/json',
  };

  // Check for existing guardian comment to update instead of spam
  const existing = await ghFetchAll(`/repos/${repo}/issues/${prNumber}/comments`);
  const prev = existing.find((c) => c.body?.includes('## 🛡️ PR Guardian Report'));

  if (prev) {
    // Update existing comment
    await fetch(`${GITHUB_API}/repos/${repo}/issues/comments/${prev.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body }),
    });
  } else {
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
  }
}

// ---------------------------------------------------------------------------
// Local mode — analyze current branch vs main without GitHub API
// ---------------------------------------------------------------------------

async function runLocal(repoRoot) {
  console.log('🛡️  PR Guardian — Local Mode\n');

  // Get changed files vs main
  const diffOutput = sh('git diff --name-status origin/main...HEAD');
  if (!diffOutput) {
    console.log('No changes detected vs origin/main.');
    process.exit(0);
  }

  const changedFiles = diffOutput.split('\n').filter(Boolean).map((line) => {
    const [status, ...rest] = line.split('\t');
    const filename = rest.join('\t');
    return {
      filename,
      status: status === 'D' ? 'removed' : status === 'A' ? 'added' : 'modified',
      additions: 0,
      deletions: 0,
    };
  });

  // Estimate additions/deletions
  for (const f of changedFiles) {
    if (f.status === 'removed') continue;
    const stat = sh(`git diff --numstat origin/main...HEAD -- "${f.filename}"`);
    if (stat) {
      const [add, del] = stat.split('\t');
      f.additions = parseInt(add, 10) || 0;
      f.deletions = parseInt(del, 10) || 0;
    }
  }

  const commitsBehind = parseInt(sh('git rev-list --count HEAD..origin/main') || '0', 10);
  const changedFileNames = changedFiles.map((f) => f.filename);

  // Determine if high-risk paths are touched (for staleness enforcement)
  const touchesHighRisk = changedFileNames.some((f) =>
    CONFIG.highRiskPaths.some((rp) => rp.endsWith('/') ? f.startsWith(rp) : f === rp),
  );

  const checks = [
    checkScope(changedFiles),
    checkStaleness(commitsBehind, touchesHighRisk),
    checkFileHealth(changedFiles, repoRoot),
    checkHighRiskPaths(changedFileNames),
    checkImports(changedFiles, repoRoot),
    checkSpread(changedFileNames),
  ];

  const report = formatReport(checks, null);
  console.log(report);

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  return hasFail ? 1 : hasWarn ? 2 : 0;
}

// ---------------------------------------------------------------------------
// CI mode — full GitHub API analysis
// ---------------------------------------------------------------------------

async function runCI(opts) {
  const { pr: prNumber, repo, dryRun } = opts;
  const repoRoot = process.cwd();

  console.log(`🛡️  PR Guardian — Analyzing PR #${prNumber} in ${repo}\n`);

  // Fetch PR metadata
  const pr = await ghFetch(`/repos/${repo}/pulls/${prNumber}`);
  const prMeta = {
    number: pr.number,
    title: pr.title,
    head: pr.head?.ref || 'unknown',
    base: pr.base?.ref || 'main',
    author: pr.user?.login || 'unknown',
  };

  // guardian:acknowledged label bypasses hard-fail checks (human has reviewed risk).
  const isAcknowledged = (pr.labels || []).some((l) => l.name === 'guardian:acknowledged');
  if (isAcknowledged) {
    console.log('ℹ️  Label `guardian:acknowledged` detected — downgrading all FAIL → WARN.');
  }

  // Fetch changed files
  const changedFiles = await ghFetchAll(`/repos/${repo}/pulls/${prNumber}/files`);
  const changedFileNames = changedFiles.map((f) => f.filename);

  // Determine if high-risk paths are touched
  const touchesHighRisk = changedFileNames.some((f) =>
    CONFIG.highRiskPaths.some((rp) => rp.endsWith('/') ? f.startsWith(rp) : f === rp),
  );

  // Calculate staleness
  let commitsBehind = 0;
  try {
    const comparison = await ghFetch(
      `/repos/${repo}/compare/${pr.head?.sha}...${pr.base?.ref}`,
    );
    commitsBehind = comparison.ahead_by || 0;
  } catch {
    // Fallback: use git locally if available
    commitsBehind = parseInt(
      sh(`git rev-list --count ${pr.head?.sha}..origin/${pr.base?.ref}`) || '0',
      10,
    );
  }

  // Run all checks
  const checks = [
    checkScope(changedFiles),
    checkStaleness(commitsBehind, touchesHighRisk),
    checkFileHealth(changedFiles, repoRoot),
    await checkOverlap(prNumber, changedFileNames, repo),
    checkHighRiskPaths(changedFileNames),
    checkImports(changedFiles, repoRoot),
    checkSpread(changedFileNames),
  ];

  const report = formatReport(checks, prMeta);
  console.log(report);

  // Post comment on PR
  if (!dryRun) {
    try {
      await postComment(repo, prNumber, report);
      console.log('\n📝 Report posted to PR.');
    } catch (err) {
      console.error(`\n⚠️  Could not post comment: ${err.message}`);
    }
  }

  // When acknowledged, treat fails as warnings so CI exits 2 (advisory, not blocking).
  const effectiveChecks = isAcknowledged
    ? checks.map((c) => c.status === 'fail' ? { ...c, status: 'warn' } : c)
    : checks;

  const hasFail = effectiveChecks.some((c) => c.status === 'fail');
  const hasWarn = effectiveChecks.some((c) => c.status === 'warn');
  return dryRun ? 0 : hasFail ? 1 : hasWarn ? 2 : 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  let exitCode;

  if (opts.local || !opts.pr) {
    const repoRoot = sh('git rev-parse --show-toplevel') || process.cwd();
    exitCode = await runLocal(repoRoot);
  } else {
    exitCode = await runCI(opts);
  }

  // Exit 2 (warn) should not block CI — map to 0
  // Only exit 1 (fail) blocks
  if (exitCode === 2) {
    console.log('\n⚠️  Warnings detected but not blocking merge.');
    process.exit(0);
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('PR Guardian error:', err);
  process.exit(1);
});
