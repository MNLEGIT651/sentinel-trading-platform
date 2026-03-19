#!/usr/bin/env python3
"""
Scaffold the next numbered Sentinel migration file.

Usage:
    python .claude/skills/sentinel-migration/scripts/new-migration.py <description>

Example:
    python .claude/skills/sentinel-migration/scripts/new-migration.py add_price_alerts
    # → creates supabase/migrations/00004_add_price_alerts.sql

Run from the project root directory.
"""

import os
import re
import sys
from pathlib import Path

MIGRATIONS_DIR = Path("supabase/migrations")

TEMPLATE = """\
-- ============================================
-- Sentinel Trading Platform - {title}
-- ============================================

-- TODO: Add your SQL here.
-- Checklist:
--   [ ] CREATE TABLE / ALTER TABLE / other DDL
--   [ ] Indexes (idx_<table>_<field>)
--   [ ] RLS: ALTER TABLE x ENABLE ROW LEVEL SECURITY;
--   [ ] RLS policy (see schema-patterns.md for patterns)
--   [ ] Realtime (if web dashboard needs live updates):
--       ALTER PUBLICATION supabase_realtime ADD TABLE my_table;

"""


def get_next_number(migrations_dir: Path) -> int:
    """Find the highest existing migration number and return the next one."""
    if not migrations_dir.exists():
        return 1
    pattern = re.compile(r"^(\d+)_")
    numbers = []
    for f in migrations_dir.iterdir():
        if f.is_file() and f.suffix == ".sql":
            m = pattern.match(f.name)
            if m:
                numbers.append(int(m.group(1)))
    return max(numbers, default=0) + 1


def slugify(description: str) -> str:
    """Convert description to a safe filename slug."""
    slug = description.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")
    return slug


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python new-migration.py <description>")
        print("Example: python new-migration.py add_price_alerts")
        sys.exit(1)

    description = " ".join(sys.argv[1:])
    slug = slugify(description)

    if not slug:
        print("Error: description produced an empty slug")
        sys.exit(1)

    # Resolve migrations dir relative to cwd (must run from project root)
    migrations_dir = Path(os.getcwd()) / MIGRATIONS_DIR
    if not migrations_dir.exists():
        print(f"Error: migrations directory not found at {migrations_dir}")
        print("Run this script from the project root directory.")
        sys.exit(1)

    next_num = get_next_number(migrations_dir)
    filename = f"{next_num:05d}_{slug}.sql"
    filepath = migrations_dir / filename

    if filepath.exists():
        print(f"Error: file already exists: {filepath}")
        sys.exit(1)

    title = description.replace("_", " ").title()
    content = TEMPLATE.format(title=title)

    filepath.write_text(content, encoding="utf-8")

    print(f"Created: {MIGRATIONS_DIR / filename}")
    print()
    print("Next steps:")
    print(f"  1. Edit the migration:  {MIGRATIONS_DIR / filename}")
    print("  2. Apply to Supabase:   npx supabase db push")
    print("  3. Regenerate TS types: npx supabase gen types typescript --local > packages/shared/src/types/database.types.ts")
    print("  4. Run tests:           .venv/Scripts/python -m pytest apps/engine/tests -x")


if __name__ == "__main__":
    main()
