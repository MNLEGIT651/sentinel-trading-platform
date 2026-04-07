# GitHub Pro Settings — Recommended Configuration

> This guide documents the GitHub repository settings that should be configured
> through the GitHub web UI after upgrading to GitHub Pro. These settings cannot
> be managed through code alone.

## 1. Branch Protection Rules

Navigate to **Settings → Branches → Add branch ruleset** (or classic protection rule).

### `main` Branch

| Setting                                          | Value | Why                                                        |
| ------------------------------------------------ | ----- | ---------------------------------------------------------- |
| Require a pull request before merging            | ✅ On | Prevent direct pushes to `main`                            |
| Required approving reviews                       | 1     | At least one review before merge                           |
| Dismiss stale pull request approvals             | ✅ On | Re-review after new commits                                |
| Require review from code owners                  | ✅ On | Enforces `.github/CODEOWNERS` (Pro feature)                |
| Require status checks to pass before merging     | ✅ On | Gate merges on CI                                          |
| — Required checks                                |       | `Test Web`, `Test Engine`, `Test Agents`, `Security Audit` |
| Require branches to be up to date before merging | ✅ On | Prevent merge skew                                         |
| Require conversation resolution before merging   | ✅ On | All review threads must be resolved                        |
| Require signed commits                           | ✅ On | Prevent unsigned commits on protected branch               |
| Require merge queue                              | ✅ On | Serializes merges and avoids base-branch races             |
| Include administrators                           | ✅ On | Rules apply to repo owner too                              |

### Why This Matters

Enabling "Require review from code owners" means PRs touching `apps/engine/`
won't merge until the engine owner approves. Signed commits + merge queue add
defense-in-depth for protected branch integrity.

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
      required_approving_review_count: 1
      dismiss_stale_reviews_on_push: true
      require_code_owner_review: true
      require_last_push_approval: false
  - type: required_status_checks
    parameters:
      strict_required_status_checks_policy: true
      required_status_checks:
        - context: Test Web
        - context: Test Engine
        - context: Test Agents
        - context: Security Audit
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

---

## 7. Summary Checklist

- [ ] Configure branch protection on `main` with required status checks
- [ ] Enable "Require review from code owners" (leverages `.github/CODEOWNERS`)
- [ ] Create `production` and `preview` environments
- [ ] Enable private vulnerability reporting
- [ ] Enable Dependabot alerts and security updates
- [ ] Enable secret scanning and push protection
- [ ] Enable auto-merge and auto-delete branches
- [ ] Review Dependabot PRs as they arrive (`.github/dependabot.yml` is active)
