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

    @patch(_PATCH_GET_BROKER)
    @patch("src.data.polygon_client.PolygonClient")
    def test_get_order_by_id(self, mock_poly_cls, mock_get_broker):
        """GET /orders/{id} should return a stored order."""
        broker = PaperBroker(initial_capital=100_000)
        mock_get_broker.return_value = broker

        mock_polygon = AsyncMock()
        mock_bar = AsyncMock()
        mock_bar.close = 250.0
        mock_polygon.get_latest_price.return_value = mock_bar
        mock_polygon.close = AsyncMock()
        mock_poly_cls.return_value = mock_polygon

        # Clear store
        from src.execution.order_store import get_order_store

        get_order_store.cache_clear()

        # Submit an order first
        submit_res = self.client.post(
            "/api/v1/portfolio/orders",
            json={"symbol": "AAPL", "side": "buy", "quantity": 5},
        )
        order_id = submit_res.json()["order_id"]

        # Fetch it by ID
        response = self.client.get(f"/api/v1/portfolio/orders/{order_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["order_id"] == order_id
        assert data["symbol"] == "AAPL"
        assert data["status"] == "filled"
        get_order_store.cache_clear()

    def test_get_order_by_id_not_found(self):
        """GET /orders/{id} should return 404 for unknown order."""
        from src.execution.order_store import get_order_store

        get_order_store.cache_clear()

        response = self.client.get("/api/v1/portfolio/orders/nonexistent-id")
        assert response.status_code == 404
        get_order_store.cache_clear()

    def test_get_order_history(self):
        """GET /orders/history should return recent orders newest-first."""
        from src.execution.order_store import StoredOrder, get_order_store

        get_order_store.cache_clear()
        store = get_order_store()

        # Seed orders with explicit timestamps for deterministic ordering
        store.add(
            StoredOrder(
                order_id="h1",
                symbol="AAPL",
                side="buy",
                order_type="market",
                qty=5,
                filled_qty=5,
                status="filled",
                fill_price=150.0,
                submitted_at="2026-01-01T00:00:00Z",
                filled_at="2026-01-01T00:00:01Z",
                risk_note=None,
            )
        )
        store.add(
            StoredOrder(
                order_id="h2",
                symbol="MSFT",
                side="buy",
                order_type="market",
                qty=3,
                filled_qty=3,
                status="filled",
                fill_price=400.0,
                submitted_at="2026-01-02T00:00:00Z",
                filled_at="2026-01-02T00:00:01Z",
                risk_note=None,
            )
        )

        response = self.client.get("/api/v1/portfolio/orders/history?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Newest first
        assert data[0]["symbol"] == "MSFT"
        assert data[1]["symbol"] == "AAPL"
        get_order_store.cache_clear()

    @patch(_PATCH_GET_BROKER)
    def test_get_orders_paper_returns_stored(self, mock_get_broker):
        """GET /orders should now return stored orders for PaperBroker."""
        from src.execution.order_store import StoredOrder, get_order_store

        get_order_store.cache_clear()

        broker = PaperBroker()
        mock_get_broker.return_value = broker

        # Manually add an order to the store
        store = get_order_store()
        store.add(
            StoredOrder(
                order_id="test-1",
                symbol="AAPL",
                side="buy",
                order_type="market",
                qty=10,
                filled_qty=10,
                status="filled",
                fill_price=150.0,
                submitted_at="2026-01-01T00:00:00Z",
                filled_at="2026-01-01T00:00:00Z",
                risk_note=None,
            )
        )

        response = self.client.get("/api/v1/portfolio/orders?status=filled")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        get_order_store.cache_clear()
