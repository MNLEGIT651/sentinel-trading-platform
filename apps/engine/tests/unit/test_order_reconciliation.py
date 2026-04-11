"""Tests for the background order reconciliation service."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.execution import get_broker
from src.execution.order_store import StoredOrder, get_order_store
from src.services import order_reconciliation
from src.services.order_reconciliation import (
    reconcile_once,
    reconciliation_loop,
    start_reconciliation_task,
)


def _make_order(order_id: str, status: str) -> StoredOrder:
    return StoredOrder(
        order_id=order_id,
        symbol="AAPL",
        side="buy",
        order_type="market",
        qty=1,
        filled_qty=0 if status != "filled" else 1,
        status=status,
        fill_price=None if status != "filled" else 150.0,
        submitted_at="2026-04-11T00:00:00Z",
        filled_at=None if status != "filled" else "2026-04-11T00:00:01Z",
        risk_note=None,
    )


@pytest.fixture(autouse=True)
def _reset_caches():
    get_broker.cache_clear()
    get_order_store.cache_clear()
    yield
    get_broker.cache_clear()
    get_order_store.cache_clear()


class TestReconcileOnce:
    @pytest.mark.asyncio
    async def test_noop_when_broker_is_paper(self):
        """PaperBroker never routes to Alpaca, so reconciliation is a no-op."""
        get_order_store().add(_make_order("p-1", "accepted"))

        refreshed = await reconcile_once()

        assert refreshed == 0

    @pytest.mark.asyncio
    async def test_noop_when_no_non_terminal_orders(self, monkeypatch):
        """Terminal orders are skipped — nothing to refresh."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://paper-api.alpaca.markets"
        alpaca._http = MagicMock()
        alpaca.refresh_order = AsyncMock()

        def _fake_get_broker():
            return alpaca

        monkeypatch.setattr(order_reconciliation, "get_broker", _fake_get_broker)

        store = get_order_store()
        store.add(_make_order("f-1", "filled"))
        store.add(_make_order("c-1", "cancelled"))
        store.add(_make_order("r-1", "rejected"))

        refreshed = await reconcile_once()

        assert refreshed == 0
        alpaca.refresh_order.assert_not_called()

    @pytest.mark.asyncio
    async def test_refreshes_non_terminal_orders_via_alpaca(self, monkeypatch):
        """Non-terminal orders trigger AlpacaBroker.refresh_order()."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://paper-api.alpaca.markets"
        alpaca._http = MagicMock()

        refreshed_order = _make_order("a-1", "filled")
        alpaca.refresh_order = AsyncMock(return_value=refreshed_order)

        monkeypatch.setattr(order_reconciliation, "get_broker", lambda: alpaca)

        store = get_order_store()
        store.add(_make_order("a-1", "accepted"))
        store.add(_make_order("a-2", "new"))
        store.add(_make_order("done", "filled"))  # must be skipped

        refreshed = await reconcile_once()

        assert refreshed == 2
        assert alpaca.refresh_order.await_count == 2
        called_ids = {call.args[0] for call in alpaca.refresh_order.call_args_list}
        assert called_ids == {"a-1", "a-2"}

    @pytest.mark.asyncio
    async def test_individual_refresh_failure_does_not_kill_sweep(self, monkeypatch):
        """One bad order ID must not stop the remaining refreshes."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://paper-api.alpaca.markets"
        alpaca._http = MagicMock()

        call_log: list[str] = []

        async def flaky_refresh(order_id: str):
            call_log.append(order_id)
            if order_id == "boom":
                raise RuntimeError("alpaca 500")
            return _make_order(order_id, "filled")

        alpaca.refresh_order = AsyncMock(side_effect=flaky_refresh)

        monkeypatch.setattr(order_reconciliation, "get_broker", lambda: alpaca)

        store = get_order_store()
        store.add(_make_order("good-1", "accepted"))
        store.add(_make_order("boom", "accepted"))
        store.add(_make_order("good-2", "accepted"))

        refreshed = await reconcile_once()

        assert refreshed == 2
        assert set(call_log) == {"good-1", "boom", "good-2"}

    @pytest.mark.asyncio
    async def test_none_result_is_not_counted(self, monkeypatch):
        """refresh_order returning None (e.g. 404) is not counted as refreshed."""
        from src.execution.alpaca_broker import AlpacaBroker

        alpaca = AlpacaBroker.__new__(AlpacaBroker)
        alpaca.base_url = "https://paper-api.alpaca.markets"
        alpaca._http = MagicMock()
        alpaca.refresh_order = AsyncMock(return_value=None)

        monkeypatch.setattr(order_reconciliation, "get_broker", lambda: alpaca)

        store = get_order_store()
        store.add(_make_order("missing", "accepted"))

        refreshed = await reconcile_once()

        assert refreshed == 0


class TestStartReconciliationTask:
    @pytest.mark.asyncio
    async def test_disabled_when_interval_zero(self):
        """Interval <= 0 must not spawn a task."""
        task = start_reconciliation_task(0)
        assert task is None

    @pytest.mark.asyncio
    async def test_disabled_when_interval_negative(self):
        task = start_reconciliation_task(-1)
        assert task is None

    @pytest.mark.asyncio
    async def test_task_cancels_cleanly(self, monkeypatch):
        """Task can be cancelled and awaited without raising outside."""
        monkeypatch.setattr(order_reconciliation, "reconcile_once", AsyncMock(return_value=0))

        task = start_reconciliation_task(0.01)
        assert task is not None

        # Let it run one iteration
        await asyncio.sleep(0.03)

        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task


class TestReconciliationLoop:
    @pytest.mark.asyncio
    async def test_loop_exits_immediately_when_disabled(self):
        """interval <= 0 returns immediately (no loop, no sleep)."""
        await asyncio.wait_for(reconciliation_loop(0), timeout=0.1)

    @pytest.mark.asyncio
    async def test_loop_swallows_sweep_exceptions(self, monkeypatch):
        """Unexpected sweep errors must not break the loop."""
        calls = {"n": 0}

        async def flaky_sweep():
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("kaboom")
            return 0

        monkeypatch.setattr(order_reconciliation, "reconcile_once", flaky_sweep)

        task = asyncio.create_task(reconciliation_loop(0.01))
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        # The loop iterated multiple times; the first raised, the rest succeeded.
        assert calls["n"] >= 2
