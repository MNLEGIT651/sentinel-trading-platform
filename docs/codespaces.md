# GitHub Codespaces for Sentinel Trading Platform

## What Is GitHub Codespaces?

GitHub Codespaces is a cloud-hosted development environment that runs inside a
Docker container on GitHub's infrastructure. When you open a Codespace for a
repository, GitHub:

1. **Spins up a VM** — a Linux virtual machine in the cloud (2–32 cores, 8–64 GB RAM).
2. **Builds a dev container** — using the `.devcontainer/devcontainer.json` config in the repo
   to install the exact runtimes, tools, and extensions the project needs.
3. **Clones the repo** — your code is ready in the container's filesystem.
4. **Runs setup scripts** — the `postCreateCommand` installs dependencies automatically.
5. **Opens an editor** — VS Code in the browser, or VS Code Desktop connected via SSH.

The result is a fully configured workspace identical for every contributor — no
"works on my machine" problems.

### Why Codespaces for Sentinel?

| Benefit                     | How it helps Sentinel                                      |
| --------------------------- | ---------------------------------------------------------- |
| **Zero local setup**        | No installing Node 22, Python 3.12, pnpm, uv individually |
| **Consistent environments** | Every contributor gets the same OS, runtimes, and tools    |
| **Port forwarding**         | Access the web dashboard, engine, and agents via URLs      |
| **Pre-installed extensions**| ESLint, Ruff, Tailwind IntelliSense, GitLens ready to go   |
| **Secrets management**      | Store API keys in Codespaces Secrets — never in `.env`     |
| **Fast onboarding**         | New contributors are productive in minutes, not hours      |

---

## Quick Start

### Option A: One-click from GitHub

1. Go to **github.com/stevenschling13/sentinel-trading-platform**
2. Click the green **`<> Code`** button → **Codespaces** tab
3. Click **Create codespace on main**
4. Wait ~2 minutes for the container to build and dependencies to install
5. Fill in your API keys (see [Secrets](#managing-secrets) below)
6. Run `pnpm dev` in the terminal — all three services start

### Option B: VS Code Desktop

1. Install the [GitHub Codespaces extension](https://marketplace.visualstudio.com/items?itemName=GitHub.codespaces)
2. Open the Command Palette → **Codespaces: Create New Codespace**
3. Select this repository and branch
4. VS Code reconnects to the remote container automatically

---

## What's Pre-Configured

### Runtimes & Tools

| Tool       | Version | Purpose                        |
| ---------- | ------- | ------------------------------ |
| Node.js    | 22      | Web dashboard, agents, turbo   |
| Python     | 3.12    | Quant engine (FastAPI)         |
| pnpm       | 10.32.1 | Node workspace package manager |
| uv         | ≥0.5    | Fast Python package installer  |
| Docker     | latest  | Container builds, compose      |
| GitHub CLI | latest  | PR/issue management            |

### Forwarded Ports

| Port | Service                      | Auto-Forward |
| ---- | ---------------------------- | ------------ |
| 3000 | Web Dashboard (Next.js)      | Notify       |
| 3001 | Agent Orchestrator (Express) | Silent       |
| 8000 | Quant Engine (FastAPI)       | Silent       |

When you run `pnpm dev`, Codespaces detects these ports and provides URLs. Click
the notification or check the **Ports** tab in VS Code.

### VS Code Extensions

Automatically installed in every Codespace:

- **Claude Code** — AI coding assistant from Anthropic (inline chat, code generation)
- **GitHub Copilot** — AI pair programming
- **ESLint** + **Prettier** — TypeScript linting & formatting
- **Python** + **Pylance** — Python IntelliSense
- **Ruff** — Python linting & formatting (matches CI)
- **Tailwind CSS IntelliSense** — class autocomplete
- **Docker** — Dockerfile and compose support
- **GitLens** — enhanced Git integration
- **Turbo** — Turborepo task runner
- **DotEnv** — `.env` file syntax highlighting
- **SQLTools** — database queries
- **Vitest Explorer** — test runner UI
- **Error Lens** — inline error/warning highlighting

---

## Managing Secrets

> **Never commit API keys to `.env` or source code.**

### Using Codespaces Secrets (Recommended)

1. Go to **github.com** → **Settings** → **Codespaces** → **Secrets**
2. Add these secrets scoped to `sentinel-trading-platform`:

   | Secret Name                       | Required | Notes                    |
   | --------------------------------- | -------- | ------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`        | Yes      | Supabase project URL     |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Yes      | Supabase anon key        |
   | `SUPABASE_URL`                    | Yes      | Same as public URL       |
   | `SUPABASE_SERVICE_ROLE_KEY`       | Yes      | Supabase service key     |
   | `POLYGON_API_KEY`                 | Yes      | Polygon.io market data   |
   | `ALPACA_API_KEY`                  | Yes      | Alpaca paper trading     |
   | `ALPACA_SECRET_KEY`               | Yes      | Alpaca secret            |
   | `ANTHROPIC_API_KEY`               | Yes      | Claude AI for agents     |
   | `ENGINE_API_KEY`                  | No       | Internal, auto-generated |

3. Codespaces injects these as environment variables automatically — no `.env`
   file needed for secrets.

### Using `.env` (Local fallback)

The `postCreateCommand` copies `.env.example` → `.env` if no `.env` exists. Edit
it to fill in your keys. This file is gitignored and never committed.

---

## Common Commands

```bash
# ── Start all services ──────────────────────────────────────
pnpm dev                    # Web (3000) + Engine (8000) + Agents (3001)

# ── Run tests ───────────────────────────────────────────────
pnpm test                   # All Node workspace tests (Vitest)
pnpm test:engine            # Python engine tests (pytest)
pnpm test:web:e2e           # Playwright end-to-end tests

# ── Lint & format ───────────────────────────────────────────
pnpm lint                   # ESLint + TypeScript checks
pnpm lint:engine            # Ruff linting for Python
pnpm format:check:engine    # Ruff format check for Python

# ── Build ───────────────────────────────────────────────────
pnpm build                  # Production build (all workspaces)

# ── Docker (full stack) ────────────────────────────────────
docker compose up --build   # Run all services in containers
```

---

## Customizing the Codespace

### Machine Type

For this monorepo with three services, a **4-core / 16 GB** machine is
recommended. You can change this when creating a Codespace or in the Codespace
settings afterward.

### Prebuilds

Repository admins can enable **Codespace prebuilds** to pre-cache the container
image and `postCreateCommand` output. This reduces startup from ~2 minutes to
~30 seconds:

1. Go to **repo Settings** → **Codespaces** → **Set up prebuilds**
2. Select the `main` branch
3. Choose your preferred region

### Dotfiles

If you have a [dotfiles repository](https://docs.github.com/en/codespaces/customizing-your-codespace/personalizing-codespaces-for-your-account),
Codespaces automatically applies your shell config, aliases, and Git settings.

---

## Troubleshooting

| Issue                        | Fix                                                    |
| ---------------------------- | ------------------------------------------------------ |
| Port not forwarding          | Check the **Ports** tab; click the globe icon to open  |
| `pnpm: command not found`    | Run `corepack enable && corepack prepare pnpm --activate` |
| Python venv not found        | Run `cd apps/engine && uv venv .venv && uv pip install --python .venv/bin/python ".[dev]"` |
| Secrets not available        | Verify secrets are scoped to this repository in GitHub Settings |
| Slow rebuilds                | Enable prebuilds (see above) or use `Rebuild Without Cache` |
| Extensions not loading       | Reload the VS Code window (`Ctrl+Shift+P` → Reload)   |
