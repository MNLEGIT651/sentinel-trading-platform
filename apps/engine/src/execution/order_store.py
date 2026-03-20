"""In-memory order store for tracking order history."""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass
from functools import lru_cache

TERMINAL_STATUSES = frozenset({"filled", "rejected", "cancelled"})


@dataclass
class StoredOrder:
    """A tracked order with full lifecycle metadata."""

    order_id: str
    symbol: str
    side: str
    order_type: str
    qty: float
    filled_qty: float
    status: str
    fill_price: float | None
    submitted_at: str
    filled_at: str | None
    risk_note: str | None


class OrderStore:
    """In-memory order store. Thread-safe for single-process FastAPI."""

    def __init__(self, max_size: int = 500) -> None:
        self._orders: dict[str, StoredOrder] = {}
        self._max_size = max_size

    def add(self, order: StoredOrder) -> None:
        self._orders[order.order_id] = order
        self._evict_if_needed()

    def update(self, order_id: str, **fields) -> StoredOrder | None:
        existing = self._orders.get(order_id)
        if existing is None:
            return None
        updated = dataclasses.replace(existing, **fields)
        self._orders[order_id] = updated
        return updated

    def get(self, order_id: str) -> StoredOrder | None:
        return self._orders.get(order_id)

    def list_orders(self, status: str | None = None) -> list[StoredOrder]:
        orders = list(self._orders.values())
        if status is not None:
            orders = [o for o in orders if o.status == status]
        return orders

    def recent(self, limit: int = 50) -> list[StoredOrder]:
        orders = sorted(
            self._orders.values(),
            key=lambda o: o.submitted_at,
            reverse=True,
        )
        return orders[:limit]

    def _evict_if_needed(self) -> None:
        if len(self._orders) <= self._max_size:
            return
        completed = sorted(
            (o for o in self._orders.values() if o.status in TERMINAL_STATUSES),
            key=lambda o: o.submitted_at,
        )
        while len(self._orders) > self._max_size and completed:
            victim = completed.pop(0)
            del self._orders[victim.order_id]


@lru_cache
def get_order_store() -> OrderStore:
    """Singleton order store instance."""
    return OrderStore()
