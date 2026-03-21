"""Tests for ApiKeyMiddleware in src.api.main.

Covers: valid key, invalid key, missing key, Bearer auth,
OPTIONS bypass, and public path bypass (/health, /docs, /openapi.json).
"""

from fastapi.testclient import TestClient

from src.api.main import _settings, app


def _unauthed_client() -> TestClient:
    """Client with NO auth headers — used to test rejection."""
    return TestClient(app)


def _authed_client() -> TestClient:
    """Client with the correct X-API-Key header."""
    c = TestClient(app)
    c.headers["X-API-Key"] = _settings.engine_api_key
    return c


# ── Public paths (no key required) ──────────────────────────────────────────


def test_health_no_key_required():
    """GET /health should succeed without any API key."""
    client = _unauthed_client()
    resp = client.get("/health")
    assert resp.status_code == 200


def test_docs_no_key_required():
    """GET /docs should succeed without any API key."""
    client = _unauthed_client()
    resp = client.get("/docs")
    assert resp.status_code == 200


def test_openapi_json_no_key_required():
    """GET /openapi.json should succeed without any API key."""
    client = _unauthed_client()
    resp = client.get("/openapi.json")
    assert resp.status_code == 200


# ── Protected paths — rejection cases ────────────────────────────────────────


def test_missing_key_returns_401():
    """Request to a protected path with no key should return 401."""
    client = _unauthed_client()
    resp = client.get("/api/v1/data/quotes")
    assert resp.status_code == 401
    body = resp.json()
    assert body["error"] == "unauthorized"


def test_invalid_key_returns_401():
    """Request with a wrong API key should return 401."""
    client = _unauthed_client()
    client.headers["X-API-Key"] = "wrong-key-12345"
    resp = client.get("/api/v1/data/quotes")
    assert resp.status_code == 401


def test_empty_key_returns_401():
    """Request with an empty X-API-Key header should return 401."""
    client = _unauthed_client()
    client.headers["X-API-Key"] = ""
    resp = client.get("/api/v1/data/quotes")
    assert resp.status_code == 401


def test_invalid_bearer_returns_401():
    """Request with a wrong Bearer token should return 401."""
    client = _unauthed_client()
    client.headers["Authorization"] = "Bearer totally-wrong-token"
    resp = client.get("/api/v1/data/quotes")
    assert resp.status_code == 401


# ── Protected paths — success cases ──────────────────────────────────────────


def test_valid_x_api_key_passes():
    """Request with correct X-API-Key should pass middleware."""
    client = _authed_client()
    # Hit health through a proxied path that requires auth
    # Using a GET that will likely 404 or succeed, but NOT 401
    resp = client.get("/api/v1/data/quotes")
    assert resp.status_code != 401


def test_valid_bearer_token_passes():
    """Request with correct Bearer token should pass middleware."""
    client = _unauthed_client()
    client.headers["Authorization"] = f"Bearer {_settings.engine_api_key}"
    resp = client.get("/api/v1/data/quotes")
    assert resp.status_code != 401


# ── OPTIONS bypass ───────────────────────────────────────────────────────────


def test_options_bypasses_auth():
    """OPTIONS requests should bypass auth (CORS preflight)."""
    client = _unauthed_client()
    resp = client.options("/api/v1/data/quotes")
    assert resp.status_code != 401
