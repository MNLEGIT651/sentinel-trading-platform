import os

import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import app


@pytest.fixture(autouse=True)
def _stub_required_env(monkeypatch):
    """Provide minimum required env vars so Settings.validate() passes in CI.

    POLYGON_API_KEY is cleared so 503-without-key tests work both locally
    (where .env sets it) and in CI. Tests that need a key set it explicitly.
    """
    monkeypatch.setenv("SUPABASE_URL", os.getenv("SUPABASE_URL", "https://stub.supabase.co"))
    monkeypatch.setenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key"),
    )
    monkeypatch.setenv("POLYGON_API_KEY", "")


@pytest.fixture
async def client():
    """Async HTTP client bound to the FastAPI app (no network)."""
    from src.api.main import _settings

    headers = {"X-API-Key": _settings.engine_api_key}
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=headers
    ) as ac:
        yield ac
