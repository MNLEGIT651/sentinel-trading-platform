# Workflows and Agents Documentation

## Overview

The Sentinel Trading Platform uses a comprehensive set of automated workflows and agent-based systems to ensure professional-grade development practices, code quality, and trading operations.

## GitHub Workflows

### CI/CD Workflows

#### 1. **CI Workflow** (`.github/workflows/ci.yml`)
- **Trigger**: Push to main, Pull requests
- **Purpose**: Primary continuous integration pipeline
- **Jobs**:
  - `test-web`: Tests Next.js web app, runs E2E tests with Playwright
  - `test-engine`: Tests Python FastAPI engine with pytest
  - `test-agents`: Tests TypeScript agent orchestrator
  - `security-audit`: Runs security vulnerability scanning
- **Technologies**: Node 22, Python 3.12, pnpm, uv, Playwright
- **Validation**: Linting, testing, building all apps
- **Timeout**: 15 minutes per job

#### 2. **Test Coverage Workflow** (`.github/workflows/test-coverage.yml`)
- **Trigger**: Pull requests, Push to main, Manual dispatch
- **Purpose**: Track and report test coverage metrics
- **Jobs**:
  - `coverage-node`: Coverage for web and agents apps
  - `coverage-python`: Coverage for engine with pytest-cov
- **Features**:
  - Generates coverage summary in PR comments
  - Supports JSON and HTML reports
  - Uploads coverage artifacts (14-day retention)
- **Timeout**: 15 minutes

#### 3. **Release Management Workflow** (`.github/workflows/release-management.yml`)
- **Trigger**: Version tags (v*.*.*), Manual dispatch
- **Purpose**: Automated release creation and validation
- **Jobs**:
  - `validate-release`: Runs full test suite before release
  - `create-release`: Generates changelog and creates GitHub release
  - `notify-deployment`: Alerts about deployment readiness
- **Features**:
  - Automatic changelog generation from commits
  - Pre-release support
  - Full validation (tests, linting, builds)
- **Timeout**: 30 minutes for validation

#### 4. **Performance Benchmarks Workflow** (`.github/workflows/performance-benchmarks.yml`)
- **Trigger**: Pull requests, Push to main, Weekly schedule, Manual dispatch
- **Purpose**: Track performance metrics across all apps
- **Jobs**:
  - `web-performance`: Lighthouse CI for web app performance
  - `engine-performance`: pytest-benchmark for engine API
  - `agents-performance`: Workflow execution benchmarks
  - `bundle-analysis`: Next.js bundle size analysis
- **Features**:
  - Core Web Vitals tracking (LCP, FCP, TBT, CLS)
  - API latency benchmarks
  - Bundle size monitoring
  - 90-day artifact retention
- **Schedule**: Weekly on Mondays at 2 AM UTC

### Code Quality Workflows

#### 5. **Claude Code Workflow** (`.github/workflows/claude.yml`)
- **Trigger**: Issue comments, PR comments, Issue opened with @claude
- **Purpose**: AI-powered code assistance and automation
- **Features**:
  - Responds to @claude mentions
  - Can read CI results
  - Provides architectural guidance
- **Timeout**: 30 minutes

#### 6. **Claude Code Review Workflow** (`.github/workflows/claude-code-review.yml`)
- **Trigger**: PR opened, synchronized, ready for review, reopened
- **Purpose**: Automated AI code review
- **Features**:
  - Analyzes code changes
  - Provides suggestions and feedback
  - Uses code-review plugin
- **Timeout**: 15 minutes

#### 7. **Auto-Label Workflow** (`.github/workflows/auto-label.yml`)
- **Trigger**: PR events (opened, synchronized, reopened), Issues opened
- **Purpose**: Automatic PR and issue labeling
- **Features**:
  - **Size labels**: XS (<50), S (<200), M (<500), L (<1000), XL (1000+)
  - **Area labels**: web, engine, agents, shared, ci, database, documentation
  - **Type labels**: tests, documentation, infrastructure
  - **Quality labels**: needs-review, high-priority, needs-description
  - Detects sensitive path changes
  - Validates PR description completeness
  - Auto-assigns PRs to authors
- **Timeout**: 5 minutes

#### 8. **Stale Management Workflow** (`.github/workflows/stale-management.yml`)
- **Trigger**: Daily at midnight UTC, Manual dispatch
- **Purpose**: Clean up stale issues and PRs
- **Configuration**:
  - **Issues**: 60 days to stale, 7 days to close
  - **PRs**: 30 days to stale, 14 days to close
  - **Exemptions**: pinned, security, critical, roadmap, in-progress, blocked
  - **Behavior**: Removes stale label when updated
- **Limit**: 100 operations per run

### Security Workflows

#### 9. **Security Safety Audit Workflow** (`.github/workflows/security-safety.yml`)
- **Trigger**: Daily at 9:17 AM UTC, Manual dispatch
- **Purpose**: Automated security vulnerability scanning
- **Features**:
  - Runs repository security audit
  - Scans Node dependencies with pnpm audit
  - Scans Python dependencies with pip-audit
  - Checks for vulnerable patterns
- **Timeout**: 15 minutes

#### 10. **Workflow Lint** (`.github/workflows/workflow-lint.yml`)
- **Trigger**: PR or push affecting workflows, Manual dispatch
- **Purpose**: Validate GitHub Actions workflow syntax
- **Tool**: actionlint v1.7.8
- **Timeout**: 10 minutes

#### 11. **Dependency Review** (`.github/workflows/dependency-review.yml`)
- **Trigger**: Pull requests
- **Purpose**: Review dependency changes for security issues
- **Features**: Automatic scanning of new dependencies

### Deployment Workflows

#### 12. **Vercel Deployment Checks** (`.github/workflows/vercel-deployment-checks.yml`)
- **Trigger**: Vercel deployment success webhook, Manual dispatch
- **Purpose**: Validate deployment health
- **Checks**:
  - `/api/health` endpoint
  - `/api/settings/status` endpoint
  - Service connectivity (engine, agents)
  - External dependencies (polygon, supabase, anthropic, alpaca)
- **Environments**: Preview (degraded dependencies allowed), Production (strict)
- **Timeout**: 10 minutes

## Agent Workflows

Agent workflows are defined in `apps/agents/workflows/*.md` as Markdown files with YAML frontmatter.

### Trading Agents

#### 1. **Market Sentinel** (`market_sentinel.md`)
- **Schedule**: Every 5 minutes during market hours
- **Cooldown**: 5 minutes
- **Tools**: get_market_data, get_market_sentiment, create_alert
- **Responsibilities**:
  - Monitor price action across watchlist
  - Detect unusual volume or volatility
  - Identify market regime changes (trending/ranging/crisis)
  - Generate alerts for significant events
  - Track sector rotation

#### 2. **Strategy Analyst** (`strategy_analyst.md`)
- **Schedule**: Every 15 minutes during market hours
- **Cooldown**: 15 minutes
- **Tools**: run_strategy_scan, get_strategy_info, get_market_data, analyze_ticker, create_alert
- **Responsibilities**:
  - Run strategy scans across instruments
  - Evaluate signal quality and conviction
  - Identify strongest trade setups
  - Provide detailed reasoning for recommendations
  - Consider correlation between signals

#### 3. **Risk Monitor** (`risk_monitor.md`)
- **Schedule**: Every 1 minute during market hours
- **Cooldown**: 1 minute
- **Tools**: assess_portfolio_risk, check_risk_limits, calculate_position_size, create_alert
- **Responsibilities**:
  - Monitor portfolio drawdown (10% soft limit, 15% hard limit)
  - Check position concentration (max 5% per position)
  - Track sector exposure (max 20% per sector)
  - Enforce daily loss limits (2% of equity)
  - HALT trading if circuit breaker triggered

#### 4. **Execution Monitor** (`execution_monitor.md`)
- **Schedule**: On demand
- **Cooldown**: 10 seconds
- **Tools**: submit_order, get_open_orders, check_risk_limits, calculate_position_size, create_alert
- **Responsibilities**:
  - Execute approved trades
  - Monitor order fill quality
  - Track order status and partial fills
  - Report execution quality metrics
  - Run final risk checks before execution

#### 5. **Research Analyst** (`research.md`)
- **Schedule**: On demand
- **Cooldown**: 30 minutes
- **Tools**: analyze_ticker, get_market_data, get_market_sentiment, create_alert
- **Responsibilities**:
  - Perform deep ticker analysis
  - Identify support/resistance levels
  - Assess trend strength and momentum
  - Evaluate volume patterns
  - Provide comprehensive research reports

### Development Agents

#### 6. **PR Manager** (`pr_manager.md`)
- **Schedule**: On PR events
- **Cooldown**: 1 minute
- **Tools**: check_pr_status, run_validation, request_review, create_alert, check_ci_status
- **Responsibilities**:
  - Validate PR description completeness
  - Check CI/CD pipeline status
  - Verify test coverage requirements
  - Ensure code follows repository conventions
  - Request appropriate reviewers
  - Block merge if critical checks fail
  - Detect sensitive path changes

**Sensitive Paths Monitored**:
- `.github/workflows/*` - affects all developers
- `supabase/migrations/*` - irreversible schema changes
- `packages/shared/*` - cross-app contracts
- `apps/web/src/lib/engine-fetch.ts` - auth boundary
- `apps/engine/src/api/main.py` - engine auth
- `apps/engine/src/config.py` - sensitive config
- `package.json`, `pnpm-lock.yaml` - dependencies
- `.env.example` - environment contract

#### 7. **Workflow Manager** (`workflow_manager.md`)
- **Schedule**: Continuous monitoring
- **Cooldown**: 2 minutes
- **Tools**: get_workflow_status, check_agent_health, analyze_workflow_performance, optimize_workflow_schedule, create_alert
- **Responsibilities**:
  - Monitor all active agent workflows
  - Detect and resolve workflow execution issues
  - Optimize workflow scheduling
  - Track performance metrics (execution time, success rate, resource usage)
  - Coordinate dependencies between workflows
  - Implement self-improvement recommendations

**Workflow Priority Order**:
1. risk_monitor (highest - capital protection)
2. execution_monitor (high - active trades)
3. market_sentinel (medium - market awareness)
4. strategy_analyst (medium - signal generation)
5. research (low - on-demand analysis)
6. pr_manager (low - development support)
7. workflow_manager (lowest - self-management)

### Agent Cycle

The trading cycle is defined in `apps/agents/workflows/cycle.md`:

**Sequence**:
1. market_sentinel — assess market conditions
2. strategy_analyst — generate signals (after market data available)
3. risk_monitor — check portfolio risk (after positions known)
4. execution_monitor — execute approved trades (after risk approval)

**Halt Conditions**:
- If risk_monitor sets halted=true, skip execution_monitor
- If market_sentinel detects crisis regime, run risk_monitor immediately

**On-Demand Agents**:
- research — triggered by specific ticker requests
- pr_manager — triggered by PR events
- workflow_manager — continuous monitoring

## Architecture Integration

### Type Definitions

Agent roles are defined in `apps/agents/src/types.ts`:
```typescript
export type AgentRole =
  | 'market_sentinel'
  | 'strategy_analyst'
  | 'risk_monitor'
  | 'research'
  | 'execution_monitor'
  | 'pr_manager'
  | 'workflow_manager';
```

### Workflow Loading

Workflows are loaded by `apps/agents/src/wat/workflow-loader.ts`:
- Parses YAML frontmatter from Markdown files
- Validates required fields (name, role, tools)
- Loads all agent workflows dynamically
- Supports hot reloading and self-improvement

### Frontmatter Schema

Each agent workflow requires:
```yaml
---
name: Agent Name
role: agent_role
description: Brief description
schedule: Schedule description
cooldown_ms: Milliseconds between runs
enabled: true/false
tools: [tool1, tool2, ...]
version: 1
last_updated_by: human/agent
---
```

## Best Practices

### For GitHub Workflows

1. **Permissions**: Use least-privilege permissions for each workflow
2. **Concurrency**: Use concurrency groups to prevent duplicate runs
3. **Timeouts**: Set reasonable timeouts (5-30 minutes)
4. **Caching**: Cache dependencies (pnpm store, uv/pip, Playwright browsers)
5. **Artifacts**: Upload important artifacts with reasonable retention
6. **Summaries**: Generate workflow summaries for visibility

### For Agent Workflows

1. **Cooldowns**: Set appropriate cooldowns to prevent rate limiting
2. **Tools**: Only include necessary tools in the tools list
3. **Halt Conditions**: Respect circuit breakers and halt conditions
4. **Error Handling**: Handle tool failures gracefully
5. **Logging**: Use create_alert for important events
6. **Self-Improvement**: Document learnings in the workflow file

## Monitoring and Observability

### Workflow Status

Check workflow runs:
```bash
gh run list --workflow=ci.yml
gh run view <run-id>
```

### Agent Status

Monitor agent health through:
- `/api/agents/status` endpoint on agents service
- Workflow manager agent monitoring
- Supabase audit logs

### Metrics Tracked

**GitHub Workflows**:
- Test pass rate
- Build duration
- Coverage percentage
- Bundle size
- Performance benchmarks

**Agent Workflows**:
- Execution frequency
- Success rate
- Average duration
- Tool usage
- Alert count

## Maintenance

### Weekly Tasks
- Review performance benchmark trends
- Check stale issue/PR cleanup effectiveness
- Review security audit findings

### Monthly Tasks
- Update workflow dependencies
- Review and optimize cooldown periods
- Analyze workflow execution patterns
- Update agent learnings section

### Quarterly Tasks
- Comprehensive workflow audit
- Agent workflow effectiveness review
- Update documentation
- Review and adjust thresholds

## Troubleshooting

### Workflow Failures

1. Check workflow logs in GitHub Actions
2. Verify permissions are correct
3. Check for rate limiting issues
4. Validate syntax with actionlint locally

### Agent Issues

1. Check agent logs in Supabase
2. Verify tool availability
3. Check cooldown status
4. Review halt conditions

### Common Issues

- **Stale caches**: Clear GitHub Actions caches
- **Permission errors**: Review workflow permissions
- **Timeout errors**: Increase timeout or optimize execution
- **Agent conflicts**: Check workflow manager for coordination issues

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Actionlint Documentation](https://github.com/rhysd/actionlint)
- [Repository Working Agreement](./ai/working-agreement.md)
- [Agent Operations Guide](./ai/agent-ops.md)
- [Deployment Guide](./deployment.md)
