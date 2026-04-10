"""Tests for the portfolio API routes."""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from src.api.main import _settings, app
from src.execution import get_broker
from src.execution.paper_broker import PaperBroker

_PATCH_GET_BROKER = "src.api.routes.portfolio.get_broker"
_PATCH_GET_DB = "src.services.order_service.get_db"


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
    @patch("src.data.polygon_client.PolygonClient")
    def test_submit_order_paper_alpaca_bypasses_live_gate(self, mock_poly_cls, mock_get_broker):
        """Alpaca broker on a paper base URL must bypass the live gate unconditionally."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://paper-api.alpaca.markets"
        alpaca._http = MagicMock()
        alpaca.get_account = AsyncMock(
            return_value={
                "account_id": "acc-1",
                "status": "ACTIVE",
                "cash": 100_000.0,
                "positions_value": 0.0,
                "equity": 100_000.0,
                "buying_power": 100_000.0,
                "initial_capital": 100_000.0,
                "pattern_day_trader": False,
                "day_trade_count": 0,
                "currency": "USD",
            }
        )
        alpaca.get_positions = AsyncMock(return_value=[])
        alpaca.submit_order = AsyncMock(
            return_value=MagicMock(
                order_id="ord-1",
                status="accepted",
                fill_price=None,
                fill_quantity=None,
                commission=None,
                slippage=None,
            )
        )
        mock_get_broker.return_value = alpaca

        response = self.client.post(
            "/api/v1/portfolio/orders",
            json={"symbol": "AAPL", "side": "buy", "quantity": 1},
        )
        assert response.status_code == 200, response.json()
        assert response.json()["order_id"] == "ord-1"

    @patch(_PATCH_GET_DB)
    @patch(_PATCH_GET_BROKER)
    def test_submit_order_live_gate_does_not_bypass_on_url_containing_paper(
        self, mock_get_broker, mock_get_db
    ):
        """Regression: a live URL containing 'paper' in path/subdomain must NOT bypass the gate.

        Protects against substring-based hostname matching. Hostname matching
        must use an explicit allowlist; any unknown hostname (even one with
        'paper' in the path or subdomain) is treated as live.
        """
        from src.execution.alpaca_broker import AlpacaBroker

        for hostile_url in (
            "https://api.alpaca.markets/paper-compat",
            "https://live.alpaca.markets/v2/paper",
            "https://paper-monitor.corp.internal/alpaca",
            "https://alpaca-paper-proxy.example.com",
        ):
            alpaca = AlpacaBroker.__new__(AlpacaBroker)
            alpaca.base_url = hostile_url
            alpaca._http = MagicMock()
            mock_get_broker.return_value = alpaca
            mock_get_db.return_value = None  # fail-closed path

            response = self.client.post(
                "/api/v1/portfolio/orders",
                json={"symbol": "AAPL", "side": "buy", "quantity": 1},
            )
            assert response.status_code == 503, (
                f"URL {hostile_url!r} must not bypass the gate, got {response.status_code}"
            )
            assert "database is not configured" in response.json()["detail"].lower()

    @patch(_PATCH_GET_DB)
    @patch(_PATCH_GET_BROKER)
    def test_submit_order_live_gate_blocks_without_db(self, mock_get_broker, mock_get_db):
        """Live Alpaca orders must fail-closed with 503 when the database is unavailable."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://api.alpaca.markets"
        alpaca._http = MagicMock()
        mock_get_broker.return_value = alpaca
        mock_get_db.return_value = None

        response = self.client.post(
            "/api/v1/portfolio/orders",
            json={"symbol": "AAPL", "side": "buy", "quantity": 1},
        )
        assert response.status_code == 503
        assert "database is not configured" in response.json()["detail"].lower()

    @patch(_PATCH_GET_DB)
    @patch(_PATCH_GET_BROKER)
    def test_submit_order_live_gate_blocks_when_flag_disabled(self, mock_get_broker, mock_get_db):
        """Live Alpaca orders must be blocked when live_execution_enabled=false."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://api.alpaca.markets"
        alpaca._http = MagicMock()
        mock_get_broker.return_value = alpaca

        mock_db = MagicMock()
        chain = mock_db.table.return_value.select.return_value
        chain.limit.return_value.single.return_value.execute.return_value = MagicMock(
            data={"live_execution_enabled": False, "global_mode": "live"}
        )
        mock_get_db.return_value = mock_db

        response = self.client.post(
            "/api/v1/portfolio/orders",
            json={"symbol": "AAPL", "side": "buy", "quantity": 1},
        )
        assert response.status_code == 403
        assert "live execution is disabled" in response.json()["detail"].lower()

    @patch(_PATCH_GET_DB)
    @patch(_PATCH_GET_BROKER)
    def test_submit_order_live_gate_blocks_when_mode_is_paper(self, mock_get_broker, mock_get_db):
        """Live Alpaca orders must be blocked when global_mode != 'live'."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://api.alpaca.markets"
        alpaca._http = MagicMock()
        mock_get_broker.return_value = alpaca

        mock_db = MagicMock()
        chain = mock_db.table.return_value.select.return_value
        chain.limit.return_value.single.return_value.execute.return_value = MagicMock(
            data={"live_execution_enabled": True, "global_mode": "paper"}
        )
        mock_get_db.return_value = mock_db

        response = self.client.post(
            "/api/v1/portfolio/orders",
            json={"symbol": "AAPL", "side": "buy", "quantity": 1},
        )
        assert response.status_code == 403
        assert "'paper' mode" in response.json()["detail"].lower()

    @patch(_PATCH_GET_DB)
    @patch(_PATCH_GET_BROKER)
    def test_submit_order_live_gate_allows_when_fully_enabled(self, mock_get_broker, mock_get_db):
        """Live Alpaca orders are allowed only when both gate conditions are satisfied."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://api.alpaca.markets"
        alpaca._http = MagicMock()
        alpaca.get_account = AsyncMock(
            return_value={
                "account_id": "acc-live",
                "status": "ACTIVE",
                "cash": 50_000.0,
                "positions_value": 0.0,
                "equity": 50_000.0,
                "buying_power": 50_000.0,
                "initial_capital": 50_000.0,
                "pattern_day_trader": False,
                "day_trade_count": 0,
                "currency": "USD",
            }
        )
        alpaca.get_positions = AsyncMock(return_value=[])
        alpaca.submit_order = AsyncMock(
            return_value=MagicMock(
                order_id="live-ord-1",
                status="accepted",
                fill_price=None,
                fill_quantity=None,
                commission=None,
                slippage=None,
            )
        )
        mock_get_broker.return_value = alpaca

        mock_db = MagicMock()
        chain = mock_db.table.return_value.select.return_value
        chain.limit.return_value.single.return_value.execute.return_value = MagicMock(
            data={"live_execution_enabled": True, "global_mode": "live"}
        )
        mock_get_db.return_value = mock_db

        response = self.client.post(
            "/api/v1/portfolio/orders",
            json={"symbol": "AAPL", "side": "buy", "quantity": 1},
        )
        assert response.status_code == 200, response.json()
        assert response.json()["order_id"] == "live-ord-1"

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
