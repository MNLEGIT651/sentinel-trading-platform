import os

# Set test defaults BEFORE importing app (Settings is evaluated at import time)
os.environ.setdefault("ENGINE_API_KEY", "test-api-key")

import pytest
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture(autouse=True)
def _stub_required_env(monkeypatch):
    """Provide minimum required env vars so Settings.validate() passes in CI."""
    monkeypatch.setenv("SUPABASE_URL", os.getenv("SUPABASE_URL", "https://stub.supabase.co"))
    monkeypatch.setenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key"),
    )
    monkeypatch.setenv("ENGINE_API_KEY", os.getenv("ENGINE_API_KEY", "test-api-key"))


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI app."""
    from src.api.main import _settings

    c = TestClient(app)
    c.headers["X-API-Key"] = _settings.engine_api_key
    return c
