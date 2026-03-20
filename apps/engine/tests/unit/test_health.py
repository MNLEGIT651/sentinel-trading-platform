from fastapi.testclient import TestClient

from src.api.main import app


def test_health_endpoint():
    """Test health endpoint returns 200 with correct body."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "sentinel-engine"
    assert "dependencies" in data
    assert set(data["dependencies"]) == {"polygon", "alpaca", "supabase"}
