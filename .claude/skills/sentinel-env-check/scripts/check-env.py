#!/usr/bin/env python3
"""
Sentinel environment variable pre-flight check.

Reads .env from the current directory (project root) and validates
all required and optional variables, grouped by service.

Usage:
    python .claude/skills/sentinel-env-check/scripts/check-env.py

Run from the project root directory.
"""

import os
import sys
from pathlib import Path

# ANSI color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

PASS = f"{GREEN}✓{RESET}"
FAIL = f"{RED}✗{RESET}"
WARN = f"{YELLOW}⚠{RESET}"

# Variable definitions: (name, required, default_value_or_None)
GROUPS = {
    "Supabase": [
        ("NEXT_PUBLIC_SUPABASE_URL", True, None),
        ("NEXT_PUBLIC_SUPABASE_ANON_KEY", True, None),
        ("SUPABASE_SERVICE_ROLE_KEY", True, None),
    ],
    "Polygon.io (Market Data)": [
        ("POLYGON_API_KEY", True, None),
    ],
    "Alpaca (Broker)": [
        ("ALPACA_API_KEY", True, None),
        ("ALPACA_SECRET_KEY", True, None),
        ("ALPACA_BASE_URL", False, "https://paper-api.alpaca.markets"),
        ("BROKER_MODE", False, "paper"),
    ],
    "Anthropic (AI Agents)": [
        ("ANTHROPIC_API_KEY", True, None),
    ],
    "Engine (Internal)": [
        ("NEXT_PUBLIC_ENGINE_URL", False, "http://localhost:8000"),
        ("ENGINE_API_KEY", False, "sentinel-dev-key"),
        ("CORS_ORIGINS", False, "http://localhost:3000"),
    ],
    "Agents (Internal)": [
        ("NEXT_PUBLIC_AGENTS_URL", False, "http://localhost:3001"),
        ("AGENTS_PORT", False, "3001"),
    ],
    "Scheduling": [
        ("DATA_INGESTION_INTERVAL_MINUTES", False, "1440"),
        ("SIGNAL_GENERATION_INTERVAL_MINUTES", False, "15"),
        ("RISK_UPDATE_INTERVAL_MINUTES", False, "5"),
    ],
}

SERVICE_NOTES = {
    "Supabase": "dashboard.supabase.com → Project → Settings → API",
    "Polygon.io (Market Data)": "polygon.io/dashboard/api-keys (free tier: 5 req/min)",
    "Alpaca (Broker)": "app.alpaca.markets → Paper Trading → API Keys",
    "Anthropic (AI Agents)": "console.anthropic.com/settings/keys",
}


def load_env(path: Path) -> dict[str, str]:
    """Parse a .env file without external dependencies."""
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        # Strip inline comments
        if " #" in value:
            value = value[: value.index(" #")].strip()
        # Strip surrounding quotes
        if len(value) >= 2 and value[0] in ('"', "'") and value[0] == value[-1]:
            value = value[1:-1]
        if key:
            env[key] = value
    return env


def check_env(env: dict[str, str]) -> tuple[int, int]:
    """Check all groups and print results. Returns (required_missing, total_required)."""
    required_missing = 0
    total_required = 0

    for group_name, variables in GROUPS.items():
        print(f"\n{BOLD}{CYAN}── {group_name} ──{RESET}")
        if group_name in SERVICE_NOTES:
            print(f"   {YELLOW}Get from:{RESET} {SERVICE_NOTES[group_name]}")

        for var_name, required, default in variables:
            value = env.get(var_name, os.environ.get(var_name, ""))

            if required:
                total_required += 1
                if value:
                    print(f"  {PASS} {var_name}")
                else:
                    required_missing += 1
                    print(f"  {FAIL} {var_name}  {RED}[REQUIRED — missing]{RESET}")
            else:
                if value:
                    # Show partial value for secrets, full value for URLs/modes
                    display = value
                    if "KEY" in var_name or "SECRET" in var_name:
                        display = value[:8] + "..." if len(value) > 8 else value
                    print(f"  {PASS} {var_name} = {display}")
                else:
                    print(f"  {WARN} {var_name}  {YELLOW}(using default: {default}){RESET}")

    return required_missing, total_required


def main() -> None:
    env_path = Path(os.getcwd()) / ".env"

    print(f"{BOLD}Sentinel Environment Check{RESET}")
    print(f"Reading: {env_path}")

    if not env_path.exists():
        print(f"\n{RED}Error: .env file not found at {env_path}{RESET}")
        print(f"Run from the project root, or copy .env.example first:")
        print(f"  cp .env.example .env")
        sys.exit(1)

    env = load_env(env_path)
    required_missing, total_required = check_env(env)

    print()
    print("─" * 50)

    if required_missing == 0:
        print(f"{GREEN}{BOLD}✓ All {total_required} required variables present. Ready to start.{RESET}")
        print()
        print("Start services:")
        print("  Engine:  cd apps/engine && .venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8000")
        print("  Web:     cd apps/web && pnpm dev")
        print("  Agents:  cd apps/agents && pnpm dev")
    else:
        print(f"{RED}{BOLD}✗ Missing {required_missing}/{total_required} required variables.{RESET}")
        print(f"Fill in the missing values in .env before starting.")
        sys.exit(1)


if __name__ == "__main__":
    main()
