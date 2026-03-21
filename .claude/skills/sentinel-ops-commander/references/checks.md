# Sentinel Ops — Detailed Check Reference

## CI Health (Deep Dive)

### List recent runs with full context
```bash
gh run list \
  --repo MNLEGIT651/sentinel-trading-platform \
  --limit 20 \
  --json databaseId,status,conclusion,name,createdAt,headBranch,headSha \
  | jq '[.[] | {id: .databaseId, status, conclusion, job: .name, branch: .headBranch, age: .createdAt}]'
```

### Get full logs for a failed run
```bash
gh run view <run-id> \
  --repo MNLEGIT651/sentinel-trading-platform \
  --log-failed 2>&1 | head -200
```

### Re-run failed jobs only (don't waste credits on passing jobs)
```bash
gh run rerun <run-id> --failed --repo MNLEGIT651/sentinel-trading-platform
```

### Check specific job within a run
```bash
gh run view <run-id> \
  --repo MNLEGIT651/sentinel-trading-platform \
  --json jobs \
  | jq '.jobs[] | {name, conclusion, steps: [.steps[] | select(.conclusion == "failure") | .name]}'
```

### Workflow failure rate (last 30 runs)
```bash
gh run list \
  --repo MNLEGIT651/sentinel-trading-platform \
  --limit 30 \
  --json conclusion \
  | jq '(map(select(.conclusion == "failure")) | length) as $fails | ($fails / 30 * 100 | floor | tostring) + "% failure rate (" + ($fails | tostring) + "/30)"'
```

---

## Pull Request Checks

### List all open PRs with age and review status
```bash
gh pr list \
  --repo MNLEGIT651/sentinel-trading-platform \
  --json number,title,author,createdAt,reviewDecision,statusCheckRollup,labels,headRefName,isDraft \
  | jq '[.[] | {
      number,
      title,
      author: .author.login,
      ageDays: ((now - (.createdAt | fromdateiso8601)) / 86400 | floor),
      review: .reviewDecision,
      ciStatus: ([.statusCheckRollup[]? | .conclusion] | unique | join(",")),
      draft: .isDraft
    }]'
```

### Comment on a stale PR
```bash
gh pr comment <pr-number> \
  --repo MNLEGIT651/sentinel-trading-platform \
  --body "👋 Automated ops check: this PR has been open for $(( ($(date +%s) - $(date -d "<created_date>" +%s)) / 86400 )) days with no review. Is it still active? If blocked, please add the \`blocked\` label."
```

### Close a draft PR stale for >30 days
```bash
gh pr close <pr-number> \
  --repo MNLEGIT651/sentinel-trading-platform \
  --comment "Closing this draft PR after 30+ days of inactivity. Reopen when ready to review."
```

---

## Issue Management

### List unlabeled open issues
```bash
gh issue list \
  --repo MNLEGIT651/sentinel-trading-platform \
  --json number,title,labels,createdAt,updatedAt,assignees \
  | jq '[.[] | select(.labels | length == 0) | {number, title, ageDays: ((now - (.createdAt | fromdateiso8601)) / 86400 | floor)}]'
```

### Add labels to an issue
```bash
gh issue edit <issue-number> \
  --repo MNLEGIT651/sentinel-trading-platform \
  --add-label "triage"
```

### List issues with no assignee and bug label
```bash
gh issue list \
  --repo MNLEGIT651/sentinel-trading-platform \
  --label "bug" \
  --json number,title,assignees \
  | jq '[.[] | select(.assignees | length == 0) | {number, title}]'
```

### Close stale issues with comment
```bash
gh issue comment <issue-number> \
  --repo MNLEGIT651/sentinel-trading-platform \
  --body "🤖 Ops commander: this issue has had no activity for 30+ days. Closing as stale. Please reopen if still relevant."
gh issue close <issue-number> --repo MNLEGIT651/sentinel-trading-platform --reason "not planned"
```

---

## Security Checks

### List open Dependabot alerts
```bash
gh api \
  /repos/MNLEGIT651/sentinel-trading-platform/dependabot/alerts \
  --jq '[.[] | select(.state=="open") | {
    number,
    severity: .security_vulnerability.severity,
    package: .security_vulnerability.package.name,
    installed: .security_vulnerability.vulnerable_version_range,
    fix: .security_vulnerability.first_patched_version.identifier,
    summary: .security_advisory.summary
  }]'
```

### Check secret scanning alerts
```bash
gh api \
  /repos/MNLEGIT651/sentinel-trading-platform/secret-scanning/alerts \
  --jq '[.[] | select(.state=="open") | {number, secret_type, created_at}]' 2>/dev/null || echo "Secret scanning not enabled or no alerts"
```

### Check code scanning alerts
```bash
gh api \
  /repos/MNLEGIT651/sentinel-trading-platform/code-scanning/alerts \
  --jq '[.[] | select(.state=="open") | {number, rule: .rule.id, severity: .rule.severity, location: .most_recent_instance.location.path}]' 2>/dev/null || echo "Code scanning not configured"
```

---

## Branch Management

### List all branches with last commit date
```bash
gh api \
  /repos/MNLEGIT651/sentinel-trading-platform/branches \
  --jq '[.[] | {name: .name, sha: .commit.sha}]'
```

### Find branches with no open PR (stale candidates)
```bash
# Get branches with open PRs
open_pr_branches=$(gh pr list --repo MNLEGIT651/sentinel-trading-platform --json headRefName | jq -r '.[].headRefName' | sort)

# Get all branches except main/deploy
all_branches=$(gh api /repos/MNLEGIT651/sentinel-trading-platform/branches --jq '[.[].name]' | jq -r '.[]' | grep -v "^main$\|^deploy/")

# Find orphaned branches (branches without open PRs)
comm -23 <(echo "$all_branches" | sort) <(echo "$open_pr_branches")
```

### Delete a stale branch (after confirming no open work)
```bash
gh api \
  --method DELETE \
  /repos/MNLEGIT651/sentinel-trading-platform/git/refs/heads/<branch-name>
```

---

## Dependency Checks

### Check for outdated packages in all apps
```bash
# From repo root
pnpm -r outdated 2>/dev/null | head -60
```

### Run security audit
```bash
pnpm audit --prod 2>&1 | tail -30
```

### Check Python deps
```bash
cd apps/engine && pip-audit --local 2>/dev/null || pip list --outdated 2>/dev/null | head -20
```

---

## Deployment Health

### Check Vercel deployment status (via MCP)
Use `list_deployments` MCP tool with:
- `projectId: prj_IOPutSQDIkXYF1LHfjMQxyMoo5tG`
- `teamId: team_1jHeAEF8oKm2Z46fqRMdu5uL`

Look at the `readyState` field: `READY` = good, `ERROR` = investigate, `BUILDING` = in progress.

### Get build logs for a failed Vercel deployment
Use `get_deployment_build_logs` MCP tool with the deployment ID from `list_deployments`.

### Check Railway deployment via GitHub deployments API
```bash
gh api \
  /repos/MNLEGIT651/sentinel-trading-platform/deployments \
  --jq '[.[] | {id, env: .environment, created: .created_at, ref: .ref}] | .[0:5]'
```

---

## Reporting

### Post ops report as GitHub issue
```bash
gh issue create \
  --repo MNLEGIT651/sentinel-trading-platform \
  --title "[ops] Weekly health report — $(date +%Y-%m-%d)" \
  --label "ops,report" \
  --body "$(cat /tmp/ops-report.md)"
```

### Update an existing pinned ops issue
```bash
gh issue edit <issue-number> \
  --repo MNLEGIT651/sentinel-trading-platform \
  --body "$(cat /tmp/ops-report.md)"
```
