"""Tests for the portfolio reconciliation service (cash/position audit)."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.execution import get_broker
from src.execution.order_store import StoredOrder, get_order_store
from src.services import portfolio_reconciliation
from src.services.portfolio_reconciliation import (
    ReconciliationReport,
    portfolio_reconciliation_loop,
    reconcile_portfolio_once,
    start_portfolio_reconciliation_task,
)


def _make_order(order_id: str, symbol: str, side: str, status: str, qty: float = 10) -> StoredOrder:
    return StoredOrder(
        order_id=order_id,
        symbol=symbol,
        side=side,
        order_type="market",
        qty=qty,
        filled_qty=qty if status == "filled" else 0,
        status=status,
        fill_price=150.0 if status == "filled" else None,
        submitted_at="2026-04-12T00:00:00Z",
        filled_at="2026-04-12T00:00:01Z" if status == "filled" else None,
        risk_note=None,
    )


@pytest.fixture(autouse=True)
def _reset_caches():
    get_broker.cache_clear()
    get_order_store.cache_clear()
    yield
    get_broker.cache_clear()
    get_order_store.cache_clear()


def _make_alpaca_broker(monkeypatch):
    """Create a mock AlpacaBroker and monkeypatch get_broker."""
    from src.execution.alpaca_broker import AlpacaBroker

    alpaca = AlpacaBroker.__new__(AlpacaBroker)
    alpaca.base_url = "https://paper-api.alpaca.markets"
    alpaca._http = MagicMock()
    monkeypatch.setattr(portfolio_reconciliation, "get_broker", lambda: alpaca)
    return alpaca


class TestReconcilePortfolioOnce:
    @pytest.mark.asyncio
    async def test_noop_when_broker_is_paper(self):
        """PaperBroker has no external state — reconciliation returns None."""
        result = await reconcile_portfolio_once()
        assert result is None

    @pytest.mark.asyncio
    async def test_clean_reconciliation_no_discrepancies(self, monkeypatch):
        """When Alpaca positions match filled orders, no discrepancies."""
        alpaca = _make_alpaca_broker(monkeypatch)
        alpaca.get_account = AsyncMock(return_value={"cash": 50000.0, "equity": 100000.0})
        alpaca.get_positions = AsyncMock(
            return_value=[
                {
                    "instrument_id": "AAPL",
                    "quantity": 10,
                    "avg_price": 150.0,
                    "market_value": 1700.0,
                    "current_price": 170.0,
                    "unrealized_pl": 200.0,
                    "unrealized_plpc": 0.13,
                    "side": "long",
                },
            ]
        )

        store = get_order_store()
        store.add(_make_order("o-1", "AAPL", "buy", "filled", qty=10))

        report = await reconcile_portfolio_once()

        assert report is not None
        assert report.has_discrepancies is False
        assert report.alpaca_cash == 50000.0
        assert report.alpaca_equity == 100000.0
        assert report.alpaca_positions_count == 1
        assert report.local_filled_orders_count == 1
        assert report.unaccounted_positions == []
        assert report.phantom_orders == []

    @pytest.mark.asyncio
    async def test_detects_unaccounted_positions(self, monkeypatch):
        """Positions in Alpaca but not in local store are flagged."""
        alpaca = _make_alpaca_broker(monkeypatch)
        alpaca.get_account = AsyncMock(return_value={"cash": 50000.0, "equity": 100000.0})
        alpaca.get_positions = AsyncMock(
            return_value=[
                {
                    "instrument_id": "AAPL",
                    "quantity": 10,
                    "avg_price": 150.0,
                    "market_value": 1700.0,
                    "current_price": 170.0,
                    "unrealized_pl": 200.0,
                    "unrealized_plpc": 0.13,
                    "side": "long",
                },
                {
                    "instrument_id": "MSFT",
                    "quantity": 5,
                    "avg_price": 300.0,
                    "market_value": 1600.0,
                    "current_price": 320.0,
                    "unrealized_pl": 100.0,
                    "unrealized_plpc": 0.06,
                    "side": "long",
                },
            ]
        )

        # Only AAPL has a filled order locally
        store = get_order_store()
        store.add(_make_order("o-1", "AAPL", "buy", "filled", qty=10))

        report = await reconcile_portfolio_once()

        assert report is not None
        assert report.has_discrepancies is True
        assert report.unaccounted_positions == ["MSFT"]
        assert report.phantom_orders == []

    @pytest.mark.asyncio
    async def test_detects_phantom_orders(self, monkeypatch):
        """Filled orders with net long but no Alpaca position are flagged."""
        alpaca = _make_alpaca_broker(monkeypatch)
        alpaca.get_account = AsyncMock(return_value={"cash": 50000.0, "equity": 100000.0})
        alpaca.get_positions = AsyncMock(return_value=[])

        # Local store has a filled buy but Alpaca shows no position
        store = get_order_store()
        store.add(_make_order("o-1", "TSLA", "buy", "filled", qty=5))

        report = await reconcile_portfolio_once()

        assert report is not None
        assert report.has_discrepancies is True
        assert report.phantom_orders == ["TSLA"]
        assert report.unaccounted_positions == []

    @pytest.mark.asyncio
    async def test_net_zero_position_not_flagged(self, monkeypatch):
        """Buy + sell (net zero) should not appear in phantom orders."""
        alpaca = _make_alpaca_broker(monkeypatch)
        alpaca.get_account = AsyncMock(return_value={"cash": 100000.0, "equity": 100000.0})
        alpaca.get_positions = AsyncMock(return_value=[])

        store = get_order_store()
        store.add(_make_order("o-1", "AAPL", "buy", "filled", qty=10))
        store.add(_make_order("o-2", "AAPL", "sell", "filled", qty=10))

        report = await reconcile_portfolio_once()

        assert report is not None
        assert report.has_discrepancies is False
        assert report.phantom_orders == []

    @pytest.mark.asyncio
    async def test_non_filled_orders_ignored(self, monkeypatch):
        """Only filled orders contribute to local position calculation."""
        alpaca = _make_alpaca_broker(monkeypatch)
        alpaca.get_account = AsyncMock(return_value={"cash": 100000.0, "equity": 100000.0})
        alpaca.get_positions = AsyncMock(return_value=[])

        store = get_order_store()
        store.add(_make_order("o-1", "AAPL", "buy", "accepted", qty=10))
        store.add(_make_order("o-2", "MSFT", "buy", "rejected", qty=5))

        report = await reconcile_portfolio_once()

        assert report is not None
        assert report.has_discrepancies is False
        assert report.local_filled_orders_count == 0

    @pytest.mark.asyncio
    async def test_persist_snapshot_failure_does_not_crash(self, monkeypatch):
        """DB errors in snapshot persistence are swallowed."""
        alpaca = _make_alpaca_broker(monkeypatch)
        alpaca.get_account = AsyncMock(return_value={"cash": 50000.0, "equity": 100000.0})
        alpaca.get_positions = AsyncMock(return_value=[])

        mock_db = MagicMock()
        mock_db.table.return_value.insert.return_value.execute.side_effect = RuntimeError("DB down")

        with patch("src.db.get_db", return_value=mock_db):
            # Should not raise
            from src.services.portfolio_reconciliation import _persist_snapshot

            report = ReconciliationReport(timestamp="2026-04-12T00:00:00Z")
            _persist_snapshot(report)  # no exception raised


class TestStartPortfolioReconciliationTask:
    @pytest.mark.asyncio
    async def test_disabled_when_interval_zero(self):
        """Interval <= 0 must not spawn a task."""
        task = start_portfolio_reconciliation_task(0)
        assert task is None

    @pytest.mark.asyncio
    async def test_disabled_when_interval_negative(self):
        task = start_portfolio_reconciliation_task(-1)
        assert task is None

    @pytest.mark.asyncio
    async def test_task_cancels_cleanly(self, monkeypatch):
        """Task can be cancelled and awaited without raising outside."""
        monkeypatch.setattr(
            portfolio_reconciliation,
            "reconcile_portfolio_once",
            AsyncMock(return_value=None),
        )

        task = start_portfolio_reconciliation_task(0.01)
        assert task is not None

        await asyncio.sleep(0.03)

        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task


class TestPortfolioReconciliationLoop:
    @pytest.mark.asyncio
    async def test_loop_exits_immediately_when_disabled(self):
        """interval <= 0 returns immediately."""
        await asyncio.wait_for(portfolio_reconciliation_loop(0), timeout=0.1)

    @pytest.mark.asyncio
    async def test_loop_swallows_sweep_exceptions(self, monkeypatch):
        """Unexpected sweep errors must not break the loop."""
        calls = {"n": 0}

        async def flaky_sweep():
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("kaboom")
            return None

        monkeypatch.setattr(portfolio_reconciliation, "reconcile_portfolio_once", flaky_sweep)

        task = asyncio.create_task(portfolio_reconciliation_loop(0.01))
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert calls["n"] >= 2
