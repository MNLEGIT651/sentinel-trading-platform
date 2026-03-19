"""Tests for the portfolio API routes."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from src.api.main import _settings, app
from src.execution import get_broker
from src.execution.paper_broker import PaperBroker

_PATCH_GET_BROKER = "src.api.routes.portfolio.get_broker"


class TestPortfolioEndpoints:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key
        get_broker.cache_clear()

    def teardown_method(self):
        get_broker.cache_clear()

    @patch(_PATCH_GET_BROKER)
    def test_get_account(self, mock_get_broker):
        broker = PaperBroker(initial_capital=100_000)
        mock_get_broker.return_value = broker

        response = self.client.get("/api/v1/portfolio/account")

        assert response.status_code == 200
        data = response.json()
        assert data["cash"] == 100_000
        assert data["equity"] == 100_000

    @patch(_PATCH_GET_BROKER)
    def test_get_positions_empty(self, mock_get_broker):
        broker = PaperBroker()
        mock_get_broker.return_value = broker

        response = self.client.get("/api/v1/portfolio/positions")

        assert response.status_code == 200
        assert response.json() == []

    @patch(_PATCH_GET_BROKER)
    def test_get_orders_empty_paper(self, mock_get_broker):
        broker = PaperBroker()
        mock_get_broker.return_value = broker

        response = self.client.get("/api/v1/portfolio/orders")

        assert response.status_code == 200
        assert response.json() == []

    @patch(_PATCH_GET_BROKER)
    @patch("src.data.polygon_client.PolygonClient")
    def test_submit_order_paper(self, mock_poly_cls, mock_get_broker):
        broker = PaperBroker(initial_capital=100_000)
        mock_get_broker.return_value = broker

        mock_polygon = AsyncMock()
        mock_bar = AsyncMock()
        mock_bar.close = 250.0
        mock_polygon.get_latest_price.return_value = mock_bar
        mock_polygon.close = AsyncMock()
        mock_poly_cls.return_value = mock_polygon

        response = self.client.post(
            "/api/v1/portfolio/orders",
            json={"symbol": "AAPL", "side": "buy", "quantity": 5},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "filled"
        assert data["fill_quantity"] == 5.0

    def test_submit_order_invalid_body(self):
        response = self.client.post(
            "/api/v1/portfolio/orders",
            json={"symbol": "AAPL"},  # Missing required 'side' and 'quantity'
        )
        assert response.status_code == 422

    @patch(_PATCH_GET_BROKER)
    def test_cancel_order_not_found(self, mock_get_broker):
        broker = PaperBroker()
        mock_get_broker.return_value = broker

        response = self.client.delete("/api/v1/portfolio/orders/nonexistent-id")

        assert response.status_code == 404
