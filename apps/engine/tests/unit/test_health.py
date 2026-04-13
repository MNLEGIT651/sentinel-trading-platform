from fastapi.testclient import TestClient

from src.api.main import app


def test_health_endpoint():
    """Test health endpoint always returns 200 (liveness semantics)."""
    client = TestClient(app)
    response = client.get("/health")
    # Health endpoint always returns 200 — degraded state is in the body, not HTTP status
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert data["service"] == "sentinel-engine"
    assert "dependencies" in data
    assert set(data["dependencies"]) == {"polygon", "alpaca", "supabase"}


def test_ready_endpoint():
    """Test readiness endpoint returns 200 or 503 with ready flag."""
    client = TestClient(app)
    response = client.get("/ready")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "ready" in data
    assert data["service"] == "sentinel-engine"
    assert "checks" in data
    assert isinstance(data["ready"], bool)
    # ready=True → 200, ready=False → 503
    if data["ready"]:
        assert response.status_code == 200
    else:
        assert response.status_code == 503
