"""Tests for the paper trading broker."""

import pytest

from src.execution.broker_interface import OrderRequest
from src.execution.paper_broker import PaperBroker


def _buy_order(instrument_id: str = "inst-1", quantity: float = 10.0) -> OrderRequest:
    return OrderRequest(
        instrument_id=instrument_id,
        side="buy",
        order_type="market",
        quantity=quantity,
    )


def _sell_order(instrument_id: str = "inst-1", quantity: float = 10.0) -> OrderRequest:
    return OrderRequest(
        instrument_id=instrument_id,
        side="sell",
        order_type="market",
        quantity=quantity,
    )


class TestPaperBrokerInitialState:
    async def test_initial_cash_equals_capital(self):
        broker = PaperBroker(initial_capital=50_000.0)
        account = await broker.get_account()
        assert account["cash"] == 50_000.0
        assert account["equity"] == 50_000.0
        assert account["initial_capital"] == 50_000.0
        assert account["positions_value"] == 0.0


class TestMarketBuy:
    async def test_buy_fills_with_slippage(self):
        broker = PaperBroker(initial_capital=100_000.0, slippage_bps=5.0)
        result = await broker.submit_order(_buy_order(), current_price=100.0)

        assert result.status == "filled"
        assert result.fill_price is not None
        assert result.fill_price >= 100.0  # Buy slippage pushes price up
        assert result.fill_quantity == 10.0
        assert result.slippage is not None
        assert result.slippage >= 0.0

    async def test_buy_reduces_cash(self):
        broker = PaperBroker(initial_capital=100_000.0, slippage_bps=0.0)
        await broker.submit_order(_buy_order(quantity=10.0), current_price=100.0)

        # With 0 slippage, cost is exactly 10 * 100 = 1000
        account = await broker.get_account()
        assert account["cash"] == pytest.approx(99_000.0)


class TestGetPositions:
    async def test_positions_after_buy(self):
        broker = PaperBroker(initial_capital=100_000.0, slippage_bps=0.0)
        await broker.submit_order(
            _buy_order(instrument_id="AAPL", quantity=5.0), current_price=150.0
        )

        positions = await broker.get_positions()
        assert len(positions) == 1
        assert positions[0]["instrument_id"] == "AAPL"
        assert positions[0]["quantity"] == 5.0
        assert positions[0]["avg_price"] == pytest.approx(150.0)


class TestSell:
    async def test_sell_closes_position(self):
        broker = PaperBroker(initial_capital=100_000.0, slippage_bps=0.0)

        # Buy 10 shares
        await broker.submit_order(_buy_order(quantity=10.0), current_price=100.0)
        # Sell 10 shares
        result = await broker.submit_order(_sell_order(quantity=10.0), current_price=105.0)

        assert result.status == "filled"
        positions = await broker.get_positions()
        assert len(positions) == 0

        # Cash should reflect buy at 100, sell at 105 (10 shares)
        account = await broker.get_account()
        assert account["cash"] == pytest.approx(100_000.0 - 1_000.0 + 1_050.0)


class TestInsufficientCash:
    async def test_buy_rejected_insufficient_cash(self):
        broker = PaperBroker(initial_capital=500.0, slippage_bps=0.0)
        result = await broker.submit_order(_buy_order(quantity=100.0), current_price=100.0)

        assert result.status == "rejected"
        assert result.fill_price is None
        assert result.fill_quantity is None

        # Cash unchanged
        account = await broker.get_account()
        assert account["cash"] == 500.0


class TestCancelOrder:
    async def test_cancel_nonexistent_raises(self):
        broker = PaperBroker()
        with pytest.raises(ValueError, match="Order not found"):
            await broker.cancel_order("nonexistent-id")


class TestOrderStore:
    def setup_method(self):
        from src.execution.order_store import get_order_store

        get_order_store.cache_clear()
        self.broker = PaperBroker(initial_capital=100_000.0, slippage_bps=0.0)
        self.buy_order = OrderRequest(
            instrument_id="AAPL",
            side="buy",
            order_type="market",
            quantity=10,
        )

    @pytest.mark.asyncio
    async def test_submit_order_writes_to_store(self):
        """Submitted orders should be recorded in the order store."""
        from src.execution.order_store import get_order_store

        get_order_store.cache_clear()
        store = get_order_store()

        result = await self.broker.submit_order(self.buy_order, current_price=150.0)

        stored = store.get(result.order_id)
        assert stored is not None
        assert stored.symbol == "AAPL"
        assert stored.status == "filled"
        assert stored.fill_price is not None
        get_order_store.cache_clear()

    @pytest.mark.asyncio
    async def test_rejected_order_written_to_store(self):
        """Rejected orders should be recorded in the order store."""
        from src.execution.order_store import get_order_store

        get_order_store.cache_clear()
        store = get_order_store()

        broker = PaperBroker(initial_capital=100.0)
        expensive_order = OrderRequest(
            instrument_id="AAPL",
            side="buy",
            order_type="market",
            quantity=1000,
        )
        result = await broker.submit_order(expensive_order, current_price=150.0)

        stored = store.get(result.order_id)
        assert stored is not None
        assert stored.status == "rejected"
        get_order_store.cache_clear()

    @pytest.mark.asyncio
    async def test_get_orders_returns_stored_orders(self):
        """get_orders() should return orders from the store."""
        from src.execution.order_store import get_order_store

        get_order_store.cache_clear()

        await self.broker.submit_order(self.buy_order, current_price=150.0)
        orders = await self.broker.get_orders(status="filled")

        assert len(orders) >= 1
        assert orders[0]["symbol"] == "AAPL"
        get_order_store.cache_clear()

    @pytest.mark.asyncio
    async def test_cancel_order_updates_store(self):
        """cancel_order() should update the store entry to cancelled."""
        from src.execution.order_store import StoredOrder, get_order_store

        get_order_store.cache_clear()
        store = get_order_store()

        # Seed an order directly into both the broker's _orders dict and the store
        # so cancel_order() can find it (PaperBroker fills instantly, so we bypass submit)
        order_id = "cancel-test-1"
        self.broker._orders[order_id] = {"id": order_id, "status": "accepted"}
        store.add(
            StoredOrder(
                order_id=order_id,
                symbol="AAPL",
                side="buy",
                order_type="market",
                qty=5,
                filled_qty=0,
                status="accepted",
                fill_price=None,
                submitted_at="2026-01-01T00:00:00Z",
                filled_at=None,
                risk_note=None,
            )
        )

        await self.broker.cancel_order(order_id)
        stored = store.get(order_id)
        assert stored is not None
        assert stored.status == "cancelled"
        get_order_store.cache_clear()


class TestSlippageModel:
    async def test_slippage_applied_buy(self):
        """Buy fill price should always be >= the current price."""
        broker = PaperBroker(initial_capital=1_000_000.0, slippage_bps=10.0)
        for _ in range(50):
            result = await broker.submit_order(_buy_order(quantity=1.0), current_price=100.0)
            assert result.fill_price is not None
            assert result.fill_price >= 100.0


class TestShortSelling:
    async def test_sell_without_position_creates_short(self):
        broker = PaperBroker(initial_capital=100_000.0, slippage_bps=0.0)
        result = await broker.submit_order(_sell_order(quantity=10.0), current_price=50.0)

        assert result.status == "filled"
        positions = await broker.get_positions()
        assert len(positions) == 1
        assert positions[0]["quantity"] == -10.0
        assert positions[0]["avg_price"] == pytest.approx(50.0)

        # Cash should increase by the sale proceeds
        account = await broker.get_account()
        assert account["cash"] == pytest.approx(100_500.0)
