# Uptime Monitoring Setup

> Guide for configuring external uptime checks and status pages for all
> Sentinel services.

## Table of Contents

- [Overview](#overview)
- [Recommended Providers](#recommended-providers)
- [Endpoints to Monitor](#endpoints-to-monitor)
- [Provider Setup Guides](#provider-setup-guides)
- [Alert Configuration](#alert-configuration)
- [Status Page Setup](#status-page-setup)
- [Integration with Health-Check Scripts](#integration-with-health-check-scripts)

---

## Overview

Sentinel's [SLO targets](../slos.md) require ≥ 99.5% uptime for the engine
and agents services during market hours. External synthetic monitoring provides
an independent signal that complements internal health endpoints and
OpenTelemetry traces.

**Architecture:**

```
Uptime Monitor
  ├─► https://sentinel-trading-platform.vercel.app       (Web)
  ├─► https://<engine>.up.railway.app/health              (Engine)
  ├─► https://<agents>.up.railway.app/health              (Agents)
  └─► https://luwyjfwauljwsfsnwiqb.supabase.co/rest/v1/  (Supabase API)
```

---

## Recommended Providers

| Provider                                                          | Free Tier                   | Key Strengths                                                     |
| ----------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| **[BetterStack (Better Uptime)](https://betterstack.com/uptime)** | 10 monitors, 3-min interval | Incident management, status pages, on-call schedules              |
| **[Checkly](https://www.checklyhq.com/)**                         | 5 checks, 10-min interval   | Playwright-based browser checks, monitoring-as-code (`.checkly/`) |
| **[UptimeRobot](https://uptimerobot.com/)**                       | 50 monitors, 5-min interval | Simple setup, generous free tier                                  |

**Recommendation:** Use **BetterStack** for its integrated incident management
and status-page features, or **Checkly** if you prefer infrastructure-as-code
workflows that can live in the repo.

---

## Endpoints to Monitor

### 1. Web App (Vercel)

| Check           | URL                                                                | Method | Expected             |
| --------------- | ------------------------------------------------------------------ | ------ | -------------------- |
| Homepage        | `https://sentinel-trading-platform.vercel.app`                     | `GET`  | `200 OK`             |
| Health API      | `https://sentinel-trading-platform.vercel.app/api/health`          | `GET`  | `200` with JSON body |
| Settings status | `https://sentinel-trading-platform.vercel.app/api/settings/status` | `GET`  | `200` with JSON body |

### 2. Engine (Railway – FastAPI)

| Check  | URL                                              | Method | Expected            |
| ------ | ------------------------------------------------ | ------ | ------------------- |
| Health | `https://<engine-service>.up.railway.app/health` | `GET`  | `200 OK` within 4 s |

> Replace `<engine-service>` with your Railway public domain. Set the domain
> in the Railway dashboard under _Settings → Networking → Public Networking_.

**Recommended keyword assertion:** Response body should contain `"status":"ok"`
or equivalent JSON field.

### 3. Agents (Railway – Express)

| Check  | URL                                              | Method | Expected             |
| ------ | ------------------------------------------------ | ------ | -------------------- |
| Health | `https://<agents-service>.up.railway.app/health` | `GET`  | `200 OK` within 6 s  |
| Status | `https://<agents-service>.up.railway.app/status` | `GET`  | `200` with JSON body |

> Replace `<agents-service>` with your Railway public domain.

### 4. Supabase API

| Check    | URL                                                 | Method | Headers              | Expected |
| -------- | --------------------------------------------------- | ------ | -------------------- | -------- |
| REST API | `https://luwyjfwauljwsfsnwiqb.supabase.co/rest/v1/` | `GET`  | `apikey: <anon-key>` | `200 OK` |

> The anon key is **public** (row-level security protects data) and can safely
> be embedded in monitoring configuration.
>
> If you prefer not to embed the key, monitor the health of
> `https://luwyjfwauljwsfsnwiqb.supabase.co` (returns `200` without auth).

---

## Provider Setup Guides

### BetterStack (Better Uptime)

1. **Create an account** at <https://betterstack.com/uptime>.
2. **Add monitors** for each endpoint above:
   - _Monitor type:_ HTTP(s)
   - _Check interval:_ 30 seconds (engine/agents) or 60 seconds (web/Supabase)
   - _Regions:_ Select at least 3 (e.g. US-East, US-West, EU-West)
   - _Request timeout:_ Match the timeouts from [`docs/deployment.md`](../deployment.md):
     - Engine health: 4 s
     - Agents health: 6 s
     - Web/Supabase: 10 s
3. **Configure alerting** (see [Alert Configuration](#alert-configuration)).
4. **Create a status page** (see [Status Page Setup](#status-page-setup)).

### Checkly (Monitoring as Code)

1. Install the CLI:
   ```bash
   pnpm add -Dw @checkly/cli
   ```
2. Initialize:
   ```bash
   npx checkly init
   ```
3. Create API checks in `.checkly/`:

   ```ts
   // .checkly/api-checks/engine-health.check.ts
   import { ApiCheck, AssertionBuilder } from 'checkly/constructs';

   new ApiCheck('engine-health', {
     name: 'Engine Health',
     request: {
       method: 'GET',
       url: 'https://<engine-service>.up.railway.app/health',
     },
     assertions: [
       AssertionBuilder.statusCode().equals(200),
       AssertionBuilder.responseTime().lessThan(4000),
     ],
     frequency: 1, // every minute
     locations: ['us-east-1', 'us-west-1', 'eu-west-1'],
   });
   ```

4. Deploy:
   ```bash
   npx checkly deploy
   ```

### UptimeRobot

1. **Sign up** at <https://uptimerobot.com>.
2. **Add HTTP monitors** for each endpoint.
3. Set monitoring interval to **every 5 minutes** (free tier minimum).
4. Enable keyword monitoring where applicable (assert `"status":"ok"` in body).

---

## Alert Configuration

### Recommended Thresholds

| Severity     | Condition                                | Action                                        |
| ------------ | ---------------------------------------- | --------------------------------------------- |
| **Warning**  | 1 failed check from any region           | Post to `#sentinel-alerts` Slack channel      |
| **Critical** | 2+ consecutive failures from ≥ 2 regions | Page on-call via PagerDuty / phone call       |
| **Recovery** | Service returns to healthy               | Post recovery to Slack, auto-resolve incident |

### Timing Recommendations

| Service  | Check Interval | Confirmation Period | Escalation Delay |
| -------- | -------------- | ------------------- | ---------------- |
| Engine   | 30 s           | 60 s (2 failures)   | 5 min            |
| Agents   | 30 s           | 60 s (2 failures)   | 5 min            |
| Web      | 60 s           | 120 s (2 failures)  | 10 min           |
| Supabase | 60 s           | 180 s (3 failures)  | 15 min           |

> **Market-hours priority:** During US market hours (09:30–16:00 ET), engine
> and agents alerts should escalate to phone/SMS. Outside market hours, Slack
> notifications are sufficient.

### Notification Channels

Configure at least two independent channels to avoid single points of failure:

1. **Slack webhook** → `#sentinel-alerts` channel
2. **Email** → team distribution list
3. **PagerDuty / Opsgenie** (optional) → on-call rotation for critical alerts

### Integration Webhooks

Most providers support outgoing webhooks on status change. Use these to:

- Trigger a GitHub Actions workflow for automated diagnostics
- Post to a shared incident channel
- Update the status page automatically

---

## Status Page Setup

A public (or private) status page lets stakeholders check service health
without pinging the team.

### BetterStack Status Page

1. Go to _Status pages → Create status page_.
2. Add component groups:
   - **Trading Platform** — Web App monitor
   - **Backend Services** — Engine health, Agents health
   - **Data Layer** — Supabase API
3. Set the custom domain (optional): `status.sentinel-trading.com`
4. Enable **auto-incident creation** when monitors go down.
5. Enable **subscriber notifications** so users can opt in to email updates.

### Minimal Self-Hosted Alternative

If you prefer a self-hosted option, [Upptime](https://upptime.js.org/) runs
entirely on GitHub Actions and GitHub Pages:

```yaml
# .github/workflows/uptime.yml (Upptime example)
name: Uptime CI
on:
  schedule:
    - cron: '*/5 * * * *' # every 5 minutes
  workflow_dispatch:
jobs:
  uptime:
    runs-on: ubuntu-latest
    steps:
      - uses: upptime/upptime@v1
```

Configure monitored sites in `.upptimerc.yml`.

---

## Integration with Health-Check Scripts

The repository's deployment documentation references health endpoints for
post-deploy smoke tests (see [`docs/deployment.md`](../deployment.md)). Below
is a reference script that can be used as a local probe or integrated into CI
for post-deployment verification.

### `scripts/health-check.sh`

```bash
#!/usr/bin/env bash
# Post-deployment health check for all Sentinel services.
# Usage: ./scripts/health-check.sh [--verbose]
#
# Exit codes:
#   0  All services healthy
#   1  One or more services unhealthy

set -euo pipefail

VERBOSE="${1:-}"

WEB_URL="${WEB_URL:-https://sentinel-trading-platform.vercel.app}"
ENGINE_URL="${ENGINE_URL:-https://<engine-service>.up.railway.app}"
AGENTS_URL="${AGENTS_URL:-https://<agents-service>.up.railway.app}"
SUPABASE_URL="${SUPABASE_URL:-https://luwyjfwauljwsfsnwiqb.supabase.co}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

FAILED=0

check() {
  local name="$1" url="$2" timeout="$3"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")

  if [[ "$status" == "200" ]]; then
    echo -e "  ${GREEN}✓${NC} ${name} (${status})"
  else
    echo -e "  ${RED}✗${NC} ${name} (${status})"
    FAILED=1
  fi

  if [[ "$VERBOSE" == "--verbose" ]]; then
    echo "    URL: ${url}"
    echo "    Timeout: ${timeout}s"
  fi
}

echo "Sentinel Health Check"
echo "====================="
echo ""
echo "Services:"
check "Web App"      "${WEB_URL}/api/health"   10
check "Engine"       "${ENGINE_URL}/health"     4
check "Agents"       "${AGENTS_URL}/health"     6
check "Supabase API" "${SUPABASE_URL}/rest/v1/" 10
echo ""

if [[ "$FAILED" -eq 1 ]]; then
  echo -e "${RED}One or more services are unhealthy.${NC}"
  exit 1
else
  echo -e "${GREEN}All services healthy.${NC}"
  exit 0
fi
```

### Using in CI (GitHub Actions)

```yaml
- name: Post-deploy health check
  env:
    ENGINE_URL: ${{ secrets.ENGINE_URL }}
    AGENTS_URL: ${{ secrets.AGENTS_URL }}
  run: |
    chmod +x scripts/health-check.sh
    # Retry up to 3 times with 10s delay (services may be cold-starting)
    for i in 1 2 3; do
      if ./scripts/health-check.sh; then
        exit 0
      fi
      echo "Attempt $i failed, retrying in 10s..."
      sleep 10
    done
    exit 1
```

### Tying Uptime Monitors to Health Checks

Configure your uptime provider to call the **same endpoints** used by the
health-check script. This ensures consistency between CI verification and
ongoing monitoring:

| Script Check               | Uptime Monitor   |
| -------------------------- | ---------------- |
| `${WEB_URL}/api/health`    | Web App monitor  |
| `${ENGINE_URL}/health`     | Engine monitor   |
| `${AGENTS_URL}/health`     | Agents monitor   |
| `${SUPABASE_URL}/rest/v1/` | Supabase monitor |
