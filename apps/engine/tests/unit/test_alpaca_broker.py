"""Tests for the Alpaca broker adapter."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.execution.alpaca_broker import AlpacaBroker
from src.execution.broker_interface import OrderRequest


class TestAlpacaBrokerInit:
    def test_requires_api_key(self):
        with pytest.raises(ValueError, match="API key"):
            AlpacaBroker(api_key="", secret_key="secret")

    def test_requires_secret_key(self):
        with pytest.raises(ValueError, match="API key"):
            AlpacaBroker(api_key="key", secret_key="")

    def test_creates_with_valid_keys(self):
        broker = AlpacaBroker(api_key="test-key", secret_key="test-secret")
        assert broker is not None


class TestAlpacaBrokerAccount:
    @pytest.fixture
    def broker(self):
        return AlpacaBroker(api_key="test-key", secret_key="test-secret")

    @pytest.mark.asyncio
    async def test_get_account(self, broker):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "acc-123",
            "status": "ACTIVE",
            "cash": "95000.00",
            "long_market_value": "5000.00",
            "short_market_value": "0.00",
            "equity": "100000.00",
            "buying_power": "190000.00",
            "last_equity": "100000.00",
            "pattern_day_trader": False,
            "daytrade_count": 0,
            "currency": "USD",
        }
        mock_response.raise_for_status = MagicMock()
        broker._http = AsyncMock()
        broker._http.get = AsyncMock(return_value=mock_response)

        result = await broker.get_account()

        assert result["account_id"] == "acc-123"
        assert result["cash"] == 95000.0
        assert result["equity"] == 100000.0
        assert result["buying_power"] == 190000.0

    @pytest.mark.asyncio
    async def test_get_positions(self, broker):
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                "symbol": "AAPL",
                "qty": "10",
                "avg_entry_price": "150.00",
                "market_value": "1600.00",
                "current_price": "160.00",
                "unrealized_pl": "100.00",
                "unrealized_plpc": "0.0667",
                "side": "long",
            }
        ]
        mock_response.raise_for_status = MagicMock()
        broker._http = AsyncMock()
        broker._http.get = AsyncMock(return_value=mock_response)

        positions = await broker.get_positions()

        assert len(positions) == 1
        assert positions[0]["instrument_id"] == "AAPL"
        assert positions[0]["quantity"] == 10.0
        assert positions[0]["current_price"] == 160.0


class TestAlpacaBrokerOrders:
    @pytest.fixture
    def broker(self):
        return AlpacaBroker(api_key="test-key", secret_key="test-secret")

    @pytest.mark.asyncio
    async def test_submit_market_order(self, broker):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "order-456",
            "status": "accepted",
            "filled_avg_price": None,
            "filled_qty": None,
        }
        mock_response.raise_for_status = MagicMock()
        broker._http = AsyncMock()
        broker._http.post = AsyncMock(return_value=mock_response)

        order = OrderRequest(
            instrument_id="AAPL",
            side="buy",
            order_type="market",
            quantity=10,
        )
        result = await broker.submit_order(order)

        assert result.order_id == "order-456"
        assert result.status == "accepted"

    @pytest.mark.asyncio
    async def test_cancel_order(self, broker):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        broker._http = AsyncMock()
        broker._http.delete = AsyncMock(return_value=mock_response)

        await broker.cancel_order("order-456")  # Should not raise

    @pytest.mark.asyncio
    async def test_get_orders(self, broker):
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                "id": "order-789",
                "symbol": "MSFT",
                "side": "buy",
                "type": "limit",
                "qty": "5",
                "filled_qty": "0",
                "status": "new",
                "submitted_at": "2026-03-15T10:00:00Z",
                "filled_avg_price": None,
            }
        ]
        mock_response.raise_for_status = MagicMock()
        broker._http = AsyncMock()
        broker._http.get = AsyncMock(return_value=mock_response)

        orders = await broker.get_orders()

        assert len(orders) == 1
        assert orders[0]["symbol"] == "MSFT"
        assert orders[0]["status"] == "new"
