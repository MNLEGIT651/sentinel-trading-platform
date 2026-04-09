#!/usr/bin/env python3
"""
Sentinel environment variable pre-flight check.

Reads `.env` at the repository root and validates variables against the same
contract as `pnpm env:check` / `scripts/check-env-contract.mjs`.

Usage (from repo root):
    python .claude/skills/sentinel-env-check/scripts/check-env.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

PASS = f"{GREEN}✓{RESET}"
FAIL = f"{RED}✗{RESET}"


def load_env(path: Path) -> dict[str, str]:
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
        if " #" in value:
            value = value[: value.index(" #")].strip()
        if len(value) >= 2 and value[0] in ('"', "'") and value[0] == value[-1]:
            value = value[1:-1]
        if key:
            env[key] = value
    return env


def has_client_key(e: dict[str, str]) -> bool:
    return bool(
        e.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "").strip()
        or e.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "").strip()
        or e.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()
    )


def nonempty(e: dict[str, str], k: str) -> bool:
    return bool(e.get(k, "").strip())


def main() -> None:
    root = Path(__file__).resolve().parents[4]
    env_path = root / ".env"

    print(f"{BOLD}Sentinel Environment Check{RESET}")
    print(f"Reading: {env_path}")

    if not env_path.exists():
        print(f"\n{RED}Error: .env not found.{RESET}")
        print("Copy .env.example to .env at the repo root, then fill values.")
        sys.exit(1)

    e = load_env(env_path)
    errors = 0

    print(f"\n{BOLD}{CYAN}── Web (required) ──{RESET}")
    if nonempty(e, "NEXT_PUBLIC_SUPABASE_URL"):
        print(f"  {PASS} NEXT_PUBLIC_SUPABASE_URL")
    else:
        errors += 1
        print(f"  {FAIL} NEXT_PUBLIC_SUPABASE_URL  {RED}[missing]{RESET}")
    if has_client_key(e):
        print(f"  {PASS} Supabase client key (publishable or anon)")
    else:
        errors += 1
        print(f"  {FAIL} Supabase client key  {RED}[set one of PUBLISHABLE_* / ANON]{RESET}")

    print(f"\n{BOLD}{CYAN}── Engine (required) ──{RESET}")
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENGINE_API_KEY"):
        if nonempty(e, k):
            print(f"  {PASS} {k}")
        else:
            errors += 1
            print(f"  {FAIL} {k}  {RED}[missing]{RESET}")

    print(f"\n{BOLD}{CYAN}── Agents (required at boot) ──{RESET}")
    for k in (
        "ANTHROPIC_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_JWT_SECRET",
        "ENGINE_URL",
        "ENGINE_API_KEY",
    ):
        if nonempty(e, k):
            print(f"  {PASS} {k}")
        else:
            errors += 1
            print(f"  {FAIL} {k}  {RED}[missing]{RESET}")

    print(f"\n{BOLD}{CYAN}── Web (recommended) ──{RESET}")
    for k, hint in (
        ("SUPABASE_SERVICE_ROLE_KEY", "server routes / webhooks"),
        ("ENGINE_URL", "same-origin proxy target"),
        ("ENGINE_API_KEY", "engine auth"),
        ("AGENTS_URL", "agents proxy target"),
    ):
        if nonempty(e, k):
            print(f"  {PASS} {k}")
        else:
            print(f"  {YELLOW}⚠{RESET} {k}  ({hint})")

    pub = (e.get("NEXT_PUBLIC_SUPABASE_URL") or "").replace("https://", "").replace("http://", "").split("/")[0]
    srv = (e.get("SUPABASE_URL") or "").replace("https://", "").replace("http://", "").split("/")[0]
    if pub and srv and pub != srv:
        print(f"\n{YELLOW}⚠ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL hosts differ.{RESET}")

    print("\n" + "─" * 50)
    if errors == 0:
        print(f"{GREEN}{BOLD}✓ Required variables for full stack are present.{RESET}")
        print("\nAlso run:  pnpm env:check")
        sys.exit(0)

    print(f"{RED}{BOLD}✗ Missing {errors} required value(s). See .env.example{RESET}")
    sys.exit(1)


if __name__ == "__main__":
    main()
