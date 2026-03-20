"""Integration tests for the data routes.

The data routes do NOT use HTTP authentication headers. They require a valid
POLYGON_API_KEY env var to reach the external service. When the key is absent,
the endpoints return 503 Service Unavailable.
"""

from unittest.mock import AsyncMock, patch


async def test_quote_endpoint_returns_503_without_polygon_key(client, monkeypatch):
    """GET /api/v1/data/quote/{ticker} returns 503 when POLYGON_API_KEY is unset."""
    monkeypatch.setenv("POLYGON_API_KEY", "")
    response = await client.get("/api/v1/data/quote/AAPL")
    assert response.status_code == 503
    body = response.json()
    assert "detail" in body


async def test_quotes_endpoint_returns_503_without_polygon_key(client, monkeypatch):
    """GET /api/v1/data/quotes returns 503 when POLYGON_API_KEY is unset."""
    monkeypatch.setenv("POLYGON_API_KEY", "")
    response = await client.get("/api/v1/data/quotes")
    assert response.status_code == 503
    body = response.json()
    assert "detail" in body


async def test_bars_endpoint_returns_503_without_polygon_key(client, monkeypatch):
    """GET /api/v1/data/bars/{ticker} returns 503 when POLYGON_API_KEY is unset."""
    monkeypatch.setenv("POLYGON_API_KEY", "")
    response = await client.get("/api/v1/data/bars/AAPL")
    assert response.status_code == 503
    body = response.json()
    assert "detail" in body


async def test_quote_with_polygon_key_returns_200_or_graceful_error(client, monkeypatch):
    """GET /api/v1/data/quote/{ticker} returns 200 when Polygon is available (mocked)."""
    monkeypatch.setenv("POLYGON_API_KEY", "fake-polygon-key")

    mock_bar = AsyncMock()
    mock_bar.open = 150.0
    mock_bar.high = 155.0
    mock_bar.low = 149.0
    mock_bar.close = 153.0
    mock_bar.volume = 1_000_000
    mock_bar.vwap = 152.0
    mock_bar.timestamp = __import__("datetime").datetime(
        2024, 1, 15, tzinfo=__import__("datetime").timezone.utc
    )

    mock_polygon = AsyncMock()
    mock_polygon.get_latest_price.return_value = mock_bar
    mock_polygon.close = AsyncMock()

    with patch("src.api.routes.data.PolygonClient", return_value=mock_polygon):
        response = await client.get("/api/v1/data/quote/AAPL")

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "AAPL"
    assert body["close"] == 153.0
    assert "change" in body
    assert "change_pct" in body


async def test_ingest_returns_503_without_supabase(client, monkeypatch):
    """POST /api/v1/data/ingest returns 503 when DB is unavailable."""
    with patch("src.api.routes.data.get_db", return_value=None):
        response = await client.post(
            "/api/v1/data/ingest",
            json={"tickers": ["AAPL"], "timeframe": "1d"},
        )
    assert response.status_code == 503
    body = response.json()
    assert "detail" in body
