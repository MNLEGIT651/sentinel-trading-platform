"""Integration tests for the health route."""


async def test_health_returns_valid_status(client):
    response = await client.get("/health")
    assert response.status_code in (200, 503)
    body = response.json()
    assert body["status"] in ("ok", "degraded")


async def test_health_includes_service_name(client):
    response = await client.get("/health")
    body = response.json()
    assert "service" in body
    assert body["service"] == "sentinel-engine"
    assert "dependencies" in body
    assert set(body["dependencies"]) == {"polygon", "alpaca", "supabase"}
