"""Integration tests for the portfolio routes.

Portfolio routes delegate to the broker (PaperBroker by default). When the
broker raises an exception, the route returns 502.
"""

from unittest.mock import patch

from src.execution.paper_broker import PaperBroker

_PATCH_GET_BROKER = "src.api.routes.portfolio.get_broker"


async def test_get_account_returns_200_with_paper_broker(client):
    """GET /api/v1/portfolio/account returns 200 with a PaperBroker."""
    broker = PaperBroker(initial_capital=100_000)
    with patch(_PATCH_GET_BROKER, return_value=broker):
        response = await client.get("/api/v1/portfolio/account")
    assert response.status_code == 200
    body = response.json()
    assert "cash" in body
    assert "equity" in body
    assert body["cash"] == 100_000
    assert body["equity"] == 100_000


async def test_get_account_returns_502_on_broker_error(client):
    """GET /api/v1/portfolio/account returns 502 when broker raises."""
    with patch(_PATCH_GET_BROKER, side_effect=RuntimeError("broker down")):
        response = await client.get("/api/v1/portfolio/account")
    assert response.status_code == 502
    body = response.json()
    assert "detail" in body


async def test_get_positions_returns_empty_list(client):
    """GET /api/v1/portfolio/positions returns empty list for fresh PaperBroker."""
    broker = PaperBroker()
    with patch(_PATCH_GET_BROKER, return_value=broker):
        response = await client.get("/api/v1/portfolio/positions")
    assert response.status_code == 200
    assert response.json() == []


async def test_get_orders_returns_empty_list_for_paper_broker(client):
    """GET /api/v1/portfolio/orders returns empty list for PaperBroker (unsupported)."""
    broker = PaperBroker()
    with patch(_PATCH_GET_BROKER, return_value=broker):
        response = await client.get("/api/v1/portfolio/orders")
    assert response.status_code == 200
    assert response.json() == []


async def test_submit_order_invalid_body_returns_422(client):
    """POST /api/v1/portfolio/orders returns 422 for missing required fields."""
    response = await client.post(
        "/api/v1/portfolio/orders",
        json={"symbol": "AAPL"},  # Missing 'side' and 'quantity'
    )
    assert response.status_code == 422


async def test_cancel_order_not_found_returns_404(client):
    """DELETE /api/v1/portfolio/orders/{id} returns 404 for unknown order ID."""
    broker = PaperBroker()
    with patch(_PATCH_GET_BROKER, return_value=broker):
        response = await client.delete("/api/v1/portfolio/orders/nonexistent-order-id")
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body
