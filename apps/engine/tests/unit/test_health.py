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
