# Sentinel Ops — Alert Thresholds

Tune these to match team velocity. These are the current baselines.

## CI

| Metric                       | WARN       | FAIL         |
|------------------------------|------------|--------------|
| Consecutive failures on main | 1          | 2            |
| Failure rate (last 30 runs)  | > 15%      | > 30%        |
| Build duration (web job)     | > 4 min    | > 8 min      |
| Time since last green run    | > 8 hours  | > 24 hours   |

## Pull Requests

| Metric                           | WARN       | FAIL         |
|----------------------------------|------------|--------------|
| PR age without review            | 5 days     | 10 days      |
| Open PR count                    | > 5        | > 10         |
| PR with failing CI (not updated) | 1 day      | 3 days       |

## Issues

| Metric                           | WARN       | FAIL         |
|----------------------------------|------------|--------------|
| Unlabeled open issues            | ≥ 1        | ≥ 5          |
| Issue inactivity                 | 14 days    | 30 days      |
| Security issue unassigned        | 24 hours   | 48 hours     |
| `bug` + no assignee              | 3 days     | 7 days       |

## Security

| Severity   | Response SLA | Auto-escalate |
|------------|--------------|---------------|
| critical   | 4 hours      | Yes           |
| high       | 24 hours     | Yes           |
| moderate   | 7 days       | No            |
| low        | 30 days      | No            |

## Deployments

| Metric                            | WARN        | FAIL         |
|-----------------------------------|-------------|--------------|
| Deploy state                      | BUILDING    | ERROR        |
| Time since last production deploy | 3 days      | 7 days       |
| Build time                        | > 3 min     | > 5 min      |
| Consecutive failed deploys        | 1           | 2            |

## Branches

| Metric                           | WARN       | FAIL        |
|----------------------------------|------------|-------------|
| Branch age (no open PR)          | 14 days    | 30 days     |
| Stale branch count               | 3          | 5           |

## Dependencies

| Metric                           | WARN             | FAIL                   |
|----------------------------------|------------------|------------------------|
| npm packages behind              | 5+ minor/patch   | Any major, or any CVE  |
| Python packages behind           | 3+ versions      | Any CVE                |
| pnpm audit findings (prod)       | moderate         | high / critical        |

## Commit Velocity (weekly audit only)

| Metric                           | WARN              | FAIL               |
|----------------------------------|-------------------|--------------------|
| Week-over-week velocity drop     | > 30%             | > 60%              |
| Weeks with zero commits          | 1 consecutive     | 2 consecutive      |
| Files with > 5 edits in 7 days   | Flag for review   | Flag + create issue |
