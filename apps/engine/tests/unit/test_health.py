from fastapi.testclient import TestClient

from src.api.main import app


def test_health_endpoint():
    """Test health endpoint returns correct body (may be degraded in test env)."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code in (200, 503)
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert data["service"] == "sentinel-engine"
    assert "dependencies" in data
    assert set(data["dependencies"]) == {"polygon", "alpaca", "supabase"}
