"""Integration tests for the strategies routes.

GET /api/v1/strategies/ requires no external services and should always succeed.
POST /api/v1/strategies/scan requires POLYGON_API_KEY and returns 503 without it.
"""

from unittest.mock import AsyncMock, patch


async def test_list_strategies_returns_200(client):
    """GET /api/v1/strategies/ returns a list of available strategies."""
    response = await client.get("/api/v1/strategies/")
    assert response.status_code == 200
    body = response.json()
    assert "strategies" in body
    assert "families" in body
    assert "total" in body
    assert isinstance(body["strategies"], list)
    assert body["total"] > 0


async def test_list_strategies_response_shape(client):
    """Each strategy entry has the expected fields."""
    response = await client.get("/api/v1/strategies/")
    body = response.json()
    strategy = body["strategies"][0]
    assert "name" in strategy
    assert "family" in strategy
    assert "description" in strategy
    assert "default_params" in strategy


async def test_get_unknown_strategy_returns_404(client):
    """GET /api/v1/strategies/{name} returns 404 for a non-existent strategy."""
    response = await client.get("/api/v1/strategies/nonexistent-strategy-xyz")
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body


async def test_get_unknown_family_returns_404(client):
    """GET /api/v1/strategies/families/{family} returns 404 for unknown family."""
    response = await client.get("/api/v1/strategies/families/nonexistent-family-xyz")
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body


async def test_scan_returns_503_without_polygon_key(client, monkeypatch):
    """POST /api/v1/strategies/scan returns 503 when POLYGON_API_KEY is not set."""
    monkeypatch.setenv("POLYGON_API_KEY", "")
    response = await client.post(
        "/api/v1/strategies/scan",
        json={"tickers": ["AAPL"]},
    )
    assert response.status_code == 503
    body = response.json()
    assert "detail" in body


async def test_scan_returns_scan_response_shape_with_polygon_key(client, monkeypatch):
    """POST /api/v1/strategies/scan returns proper ScanResponse shape (mocked Polygon)."""
    monkeypatch.setenv("POLYGON_API_KEY", "fake-polygon-key")

    # When Polygon returns no bars, the scan returns empty signals gracefully
    mock_polygon = AsyncMock()
    mock_polygon.get_bars.return_value = []
    mock_polygon.close = AsyncMock()

    with patch("src.api.routes.strategies.PolygonClient", return_value=mock_polygon):
        response = await client.post(
            "/api/v1/strategies/scan",
            json={"tickers": ["AAPL"]},
        )

    assert response.status_code == 200
    body = response.json()
    assert "signals" in body
    assert "total_signals" in body
    assert "tickers_scanned" in body
    assert "strategies_run" in body
    assert "errors" in body
