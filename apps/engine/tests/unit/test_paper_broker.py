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
        await broker.submit_order(_buy_order(instrument_id="AAPL", quantity=5.0), current_price=150.0)

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


class TestSlippageModel:
    async def test_slippage_applied_buy(self):
        """Buy fill price should always be >= the current price."""
        broker = PaperBroker(initial_capital=1_000_000.0, slippage_bps=10.0)
        for _ in range(50):
            result = await broker.submit_order(
                _buy_order(quantity=1.0), current_price=100.0
            )
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
