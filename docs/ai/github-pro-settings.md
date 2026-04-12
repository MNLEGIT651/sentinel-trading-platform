# GitHub Control Plane Settings — Guarded Auto Configuration

> This guide documents the GitHub repository settings that should be configured
> for the Sentinel guarded-auto engineering control plane. Prefer
> `node scripts/sync-github-control-plane.mjs --apply` for repo settings, labels,
> and protected-branch rules. Use the GitHub UI only for features without a stable
> API surface.

## 0. Sync command

```bash
node scripts/sync-github-control-plane.mjs --apply --repo stevenschling13/Trading-App --default-branch main
```

## 1. Branch Protection Rules

Navigate to **Settings → Branches → Add branch ruleset** (or classic protection rule).

### `main` Branch

| Setting                                          | Value    | Why                                                                                                      |
| ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| Require a pull request before merging            | ✅ On    | Prevent direct pushes to `main`                                                                          |
| Required approving reviews                       | 0        | Low-risk PRs may auto-merge after checks                                                                 |
| Dismiss stale pull request approvals             | ✅ On    | Re-review after new commits                                                                              |
| Require review from code owners                  | ❌ Off   | Human approval is conditional, not blanket                                                               |
| Require status checks to pass before merging     | ✅ On    | Gate merges on CI                                                                                        |
| — Required checks                                |          | `Verify Commit Signatures`, `Test Web`, `Test Engine`, `Test Agents`, `Security Audit`, `Policy Verdict` |
| Require branches to be up to date before merging | ✅ On    | Prevent merge skew                                                                                       |
| Require conversation resolution before merging   | ✅ On    | All review threads must be resolved                                                                      |
| Require signed commits                           | Optional | Use only if it does not block trusted bot/web-flow commits                                               |
| Require linear history                           | ✅ On    | Clean history; no merge commits on `main`                                                                |
| Include administrators                           | ✅ On    | Rules apply to repo owner too                                                                            |

### Escalated PR flow

- Protected-path, auth, schema, deployment, and trust-boundary changes must receive
  `decision/human-approved` from the human owner before merge.
- `Policy Verdict` enforces that requirement automatically.

### Why This Matters

With GitHub Pro, CODEOWNERS enforcement actually works — on the free tier the
file is parsed but not enforced. Enabling "Require review from code owners"
means PRs touching `apps/engine/` won't merge until the engine owner approves.

---

## 2. Repository Rulesets (Pro Feature)

Rulesets are the newer, more flexible replacement for classic branch protection.
Navigate to **Settings → Rules → Rulesets → New ruleset**.

### Recommended Ruleset: `main-protection`

```yaml
name: main-protection
target: branch
enforcement: active
conditions:
  ref_name:
    include: [refs/heads/main]
rules:
  - type: pull_request
    parameters:
      required_approving_review_count: 0
      dismiss_stale_reviews_on_push: true
      require_code_owner_review: false
      require_last_push_approval: false
  - type: required_status_checks
    parameters:
      strict_required_status_checks_policy: true
      required_status_checks:
        - context: Verify Commit Signatures
        - context: Test Web
        - context: Test Engine
        - context: Test Agents
        - context: Security Audit
        - context: Policy Verdict
  - type: non_fast_forward
```

---

## 3. Environments (Pro Feature)

Protected deployment environments add approval gates before deployment.
Navigate to **Settings → Environments**.

### `production`

| Setting                  | Value             |
| ------------------------ | ----------------- |
| Required reviewers       | `stevenschling13` |
| Wait timer               | 0 minutes         |
| Deployment branch policy | `main` only       |

### `preview`

| Setting                  | Value        |
| ------------------------ | ------------ |
| Required reviewers       | (none)       |
| Deployment branch policy | All branches |

### Usage in Workflows

```yaml
jobs:
  deploy:
    environment:
      name: production
      url: https://your-app.vercel.app
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying..."
```

---

## 4. Dependabot

Dependabot is now configured via `.github/dependabot.yml`. It covers:

- **GitHub Actions** — weekly updates, grouped
- **npm** — root, web, agents, shared packages
- **pip** — Python engine dependencies

### Auto-Merge for Dependabot (Optional)

You can enable auto-merge for patch-level Dependabot PRs. Add this workflow:

```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-merge
on: pull_request
permissions:
  contents: write
  pull-requests: write
jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: dependabot/fetch-metadata@v2
        id: metadata
      - if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 5. Private Vulnerability Reporting

Navigate to **Settings → Security → Code security and analysis**:

| Setting                         | Recommended |
| ------------------------------- | ----------- |
| Private vulnerability reporting | ✅ Enable   |
| Dependabot alerts               | ✅ Enable   |
| Dependabot security updates     | ✅ Enable   |
| Dependency graph                | ✅ Enable   |
| Secret scanning                 | ✅ Enable   |
| Secret scanning push protection | ✅ Enable   |

---

## 6. Auto-Merge

Navigate to **Settings → General → Pull Requests**:

| Setting                            | Recommended    |
| ---------------------------------- | -------------- |
| Allow auto-merge                   | ✅ Enable      |
| Automatically delete head branches | ✅ Enable      |
| Allow squash merging               | ✅ Enable      |
| Default to squash merge            | ✅ Recommended |

Auto-merge should remain guarded by the policy workflow:

- low-risk PRs: auto-merge allowed after all required checks pass
- escalated PRs: blocked until `decision/human-approved`

---

## 7. Summary Checklist

- [x] Configure branch protection on `main` with required status checks
- [x] Enable "Require review from code owners" (leverages `.github/CODEOWNERS`)
- [x] Require signed commits for authenticity
- [x] Require linear history (no merge commits)
- [ ] Create `production` and `preview` environments
- [x] Enable private vulnerability reporting
- [x] Enable Dependabot alerts and security updates
- [x] Enable secret scanning and push protection
- [x] Enable CodeQL default setup
- [x] Enable auto-merge and auto-delete branches
- [x] Review Dependabot PRs as they arrive (`.github/dependabot.yml` is active)
