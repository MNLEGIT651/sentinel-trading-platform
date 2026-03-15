"""Supabase database client using PostgREST directly.

We use postgrest-py directly instead of the full supabase-py package
to avoid heavy transitive dependencies (pyiceberg, pyroaring) that
don't build cleanly on Python 3.14. This gives us the same table()
API for CRUD operations.
"""

import logging
from functools import lru_cache

from postgrest import SyncPostgrestClient

from src.config import Settings

logger = logging.getLogger(__name__)


class SupabaseDB:
    """Lightweight Supabase client wrapping PostgREST."""

    def __init__(self, url: str, service_role_key: str) -> None:
        self._rest_url = f"{url}/rest/v1"
        self._headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        }
        self._client = SyncPostgrestClient(
            base_url=self._rest_url,
            headers=self._headers,
        )

    def table(self, name: str):
        """Access a table for CRUD operations (same API as supabase-py)."""
        return self._client.from_(name)

    def rpc(self, fn: str, params: dict | None = None):
        """Call a Postgres function via PostgREST."""
        return self._client.rpc(fn, params or {})


@lru_cache
def get_db() -> SupabaseDB | None:
    """Create and cache the database client. Returns None if not configured."""
    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set — "
            "database features disabled. Set them in .env to enable."
        )
        return None
    return SupabaseDB(settings.supabase_url, settings.supabase_service_role_key)
