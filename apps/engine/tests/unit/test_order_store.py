"""Tests for the in-memory order store."""

from datetime import UTC, datetime

from src.execution.order_store import OrderStore, StoredOrder


def _make_order(**overrides) -> StoredOrder:
    defaults = {
        "order_id": "order-1",
        "symbol": "AAPL",
        "side": "buy",
        "order_type": "market",
        "qty": 10.0,
        "filled_qty": 10.0,
        "status": "filled",
        "fill_price": 150.0,
        "submitted_at": datetime.now(UTC).isoformat(),
        "filled_at": datetime.now(UTC).isoformat(),
        "risk_note": None,
    }
    defaults.update(overrides)
    return StoredOrder(**defaults)


class TestOrderStore:
    def setup_method(self):
        self.store = OrderStore()

    def test_add_and_get(self):
        order = _make_order()
        self.store.add(order)
        assert self.store.get("order-1") == order

    def test_get_missing_returns_none(self):
        assert self.store.get("nonexistent") is None

    def test_update_fields(self):
        self.store.add(_make_order(status="accepted", fill_price=None))
        updated = self.store.update("order-1", status="filled", fill_price=150.0)
        assert updated is not None
        assert updated.status == "filled"
        assert updated.fill_price == 150.0

    def test_update_missing_returns_none(self):
        assert self.store.update("nonexistent", status="filled") is None

    def test_list_orders_all(self):
        self.store.add(_make_order(order_id="o1", status="filled"))
        self.store.add(_make_order(order_id="o2", status="accepted"))
        assert len(self.store.list_orders()) == 2

    def test_list_orders_by_status(self):
        self.store.add(_make_order(order_id="o1", status="filled"))
        self.store.add(_make_order(order_id="o2", status="accepted"))
        result = self.store.list_orders(status="filled")
        assert len(result) == 1
        assert result[0].order_id == "o1"

    def test_recent_returns_newest_first(self):
        self.store.add(_make_order(order_id="o1", submitted_at="2026-01-01T00:00:00Z"))
        self.store.add(_make_order(order_id="o2", submitted_at="2026-01-02T00:00:00Z"))
        recent = self.store.recent(limit=2)
        assert recent[0].order_id == "o2"
        assert recent[1].order_id == "o1"

    def test_recent_respects_limit(self):
        for i in range(10):
            self.store.add(_make_order(order_id=f"o{i}"))
        assert len(self.store.recent(limit=3)) == 3

    def test_eviction_at_cap(self):
        store = OrderStore(max_size=5)
        for i in range(7):
            store.add(
                _make_order(
                    order_id=f"o{i}",
                    status="filled",
                    submitted_at=f"2026-01-{i + 1:02d}T00:00:00Z",
                )
            )
        assert len(store.list_orders()) == 5
        # Oldest completed orders should be evicted
        assert store.get("o0") is None
        assert store.get("o1") is None
        assert store.get("o6") is not None


class TestTerminalStatusGuard:
    """Regression tests for terminal order status guard (Patch 9)."""

    def setup_method(self):
        self.store = OrderStore()

    def test_rejects_status_change_on_filled_order(self):
        self.store.add(_make_order(order_id="t1", status="filled"))
        result = self.store.update("t1", status="pending")
        assert result is not None
        assert result.status == "filled"

    def test_rejects_status_change_on_cancelled_order(self):
        self.store.add(_make_order(order_id="t2", status="cancelled"))
        result = self.store.update("t2", status="open")
        assert result.status == "cancelled"

    def test_rejects_status_change_on_rejected_order(self):
        self.store.add(_make_order(order_id="t3", status="rejected"))
        result = self.store.update("t3", status="accepted")
        assert result.status == "rejected"

    def test_allows_non_status_update_on_terminal_order(self):
        self.store.add(_make_order(order_id="t4", status="filled"))
        result = self.store.update("t4", risk_note="manual review")
        assert result.risk_note == "manual review"
        assert result.status == "filled"

    def test_allows_status_change_on_non_terminal_order(self):
        self.store.add(_make_order(order_id="t5", status="accepted"))
        result = self.store.update("t5", status="filled")
        assert result.status == "filled"

    def test_eviction_preserves_open_orders(self):
        store = OrderStore(max_size=3)
        store.add(
            _make_order(order_id="open1", status="accepted", submitted_at="2026-01-01T00:00:00Z")
        )
        for i in range(4):
            store.add(
                _make_order(
                    order_id=f"filled{i}",
                    status="filled",
                    submitted_at=f"2026-01-{i + 2:02d}T00:00:00Z",
                )
            )
        # Open order should survive eviction
        assert store.get("open1") is not None
