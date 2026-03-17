"""Integration tests for the risk routes.

All risk endpoints are self-contained (no external services required) and
should return 200 for well-formed requests.
"""


async def test_get_risk_limits_returns_200(client):
    """GET /api/v1/risk/limits returns the current RiskLimits configuration."""
    response = await client.get("/api/v1/risk/limits")
    assert response.status_code == 200
    body = response.json()
    assert "max_position_pct" in body
    assert "max_sector_pct" in body
    assert "max_drawdown_soft" in body
    assert "max_drawdown_hard" in body
    assert "max_open_positions" in body


async def test_get_risk_limits_values_are_positive(client):
    """Risk limit values should be positive numbers."""
    response = await client.get("/api/v1/risk/limits")
    body = response.json()
    assert body["max_position_pct"] > 0
    assert body["max_drawdown_hard"] > 0
    assert body["max_open_positions"] > 0


async def test_calculate_position_size_returns_200(client):
    """POST /api/v1/risk/position-size returns a valid sizing result."""
    response = await client.post(
        "/api/v1/risk/position-size",
        json={
            "ticker": "AAPL",
            "price": 150.0,
            "equity": 100_000.0,
            "risk_fraction": 0.01,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "AAPL"
    assert "shares" in body
    assert "dollar_amount" in body
    assert "weight" in body
    assert "method" in body
    assert body["shares"] >= 0


async def test_calculate_position_size_invalid_body_returns_422(client):
    """POST /api/v1/risk/position-size returns 422 for missing required fields."""
    response = await client.post(
        "/api/v1/risk/position-size",
        json={"ticker": "AAPL"},  # Missing required 'price'
    )
    assert response.status_code == 422


async def test_assess_portfolio_risk_returns_200(client):
    """POST /api/v1/risk/assess returns a risk assessment dict."""
    response = await client.post(
        "/api/v1/risk/assess",
        json={
            "equity": 100_000.0,
            "cash": 50_000.0,
            "peak_equity": 105_000.0,
            "daily_starting_equity": 100_000.0,
        },
    )
    assert response.status_code == 200
    body = response.json()
    # The assessment should return some structured dict
    assert isinstance(body, dict)


async def test_pre_trade_check_buy_returns_200(client):
    """POST /api/v1/risk/pre-trade-check returns allowed/blocked result for a buy."""
    response = await client.post(
        "/api/v1/risk/pre-trade-check",
        json={
            "ticker": "AAPL",
            "shares": 10,
            "price": 150.0,
            "side": "buy",
            "equity": 100_000.0,
            "cash": 80_000.0,
            "peak_equity": 100_000.0,
            "daily_starting_equity": 100_000.0,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "allowed" in body
    assert "action" in body
    assert "reason" in body
    assert isinstance(body["allowed"], bool)
