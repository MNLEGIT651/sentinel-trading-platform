"""Order store with optional DB persistence for experiment tracking."""

from __future__ import annotations

import dataclasses
import logging
from dataclasses import dataclass
from functools import lru_cache

TERMINAL_STATUSES = frozenset({"filled", "rejected", "cancelled"})

logger = logging.getLogger(__name__)


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
    experiment_id: str | None = None
    is_shadow: bool = False
    phase: str | None = None
    recommendation_id: str | None = None
    broker_order_id: str | None = None


class OrderStore:
    """Order store with in-memory cache and optional DB write-through.

    When experiment_id is set, orders are persisted to experiment_orders.
    """

    def __init__(
        self,
        max_size: int = 500,
        experiment_id: str | None = None,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
    ) -> None:
        self._orders: dict[str, StoredOrder] = {}
        self._max_size = max_size
        self._experiment_id = experiment_id
        self._supabase_url = supabase_url
        self._supabase_key = supabase_key
        self._db_available = bool(experiment_id and supabase_url and supabase_key)

        if self._db_available:
            logger.info(
                "OrderStore: DB write-through enabled for experiment %s",
                experiment_id,
            )
            self._hydrate_from_db()

    def add(self, order: StoredOrder) -> None:
        if self._experiment_id and not order.experiment_id:
            order = dataclasses.replace(order, experiment_id=self._experiment_id)
        self._orders[order.order_id] = order
        self._persist_order(order)
        self._evict_if_needed()

    def update(self, order_id: str, **fields: object) -> StoredOrder | None:
        existing = self._orders.get(order_id)
        if existing is None:
            return None
        updated = dataclasses.replace(existing, **fields)
        self._orders[order_id] = updated
        self._persist_update(order_id, fields)
        return updated

    def get(self, order_id: str) -> StoredOrder | None:
        return self._orders.get(order_id)

    def list_orders(
        self, status: str | None = None, experiment_id: str | None = None
    ) -> list[StoredOrder]:
        orders = list(self._orders.values())
        if status is not None:
            orders = [o for o in orders if o.status == status]
        if experiment_id is not None:
            orders = [o for o in orders if o.experiment_id == experiment_id]
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

    # ── DB persistence ────────────────────────────────────────────

    def _get_client(self):
        """Lazily import and create a Supabase client."""
        if not self._db_available:
            return None
        try:
            from supabase import create_client

            return create_client(self._supabase_url, self._supabase_key)
        except Exception:
            logger.warning("OrderStore: failed to create Supabase client", exc_info=True)
            return None

    def _hydrate_from_db(self) -> None:
        """Load existing orders from experiment_orders on startup."""
        client = self._get_client()
        if not client:
            return
        try:
            resp = (
                client.table("experiment_orders")
                .select("*")
                .eq("experiment_id", self._experiment_id)
                .order("submitted_at", desc=True)
                .limit(self._max_size)
                .execute()
            )
            for row in resp.data or []:
                order = StoredOrder(
                    order_id=row["id"],
                    symbol=row["symbol"],
                    side=row["side"],
                    order_type=row.get("order_type", "market"),
                    qty=float(row.get("quantity", 0)),
                    filled_qty=float(row.get("fill_quantity", 0) or 0),
                    status=row.get("status", "pending"),
                    fill_price=(
                        float(row["fill_price"]) if row.get("fill_price") is not None else None
                    ),
                    submitted_at=row.get("submitted_at", ""),
                    filled_at=row.get("filled_at"),
                    risk_note=row.get("risk_note"),
                    experiment_id=row.get("experiment_id"),
                    is_shadow=row.get("is_shadow", False),
                    phase=row.get("phase"),
                    recommendation_id=row.get("recommendation_id"),
                    broker_order_id=row.get("broker_order_id"),
                )
                self._orders[order.order_id] = order
            logger.info(
                "OrderStore: hydrated %d orders from DB for experiment %s",
                len(resp.data or []),
                self._experiment_id,
            )
        except Exception:
            logger.warning("OrderStore: DB hydration failed", exc_info=True)

    def _persist_order(self, order: StoredOrder) -> None:
        """Write-through: insert new order to experiment_orders."""
        if not self._db_available or not order.experiment_id:
            return
        client = self._get_client()
        if not client:
            return
        try:
            client.table("experiment_orders").insert(
                {
                    "experiment_id": order.experiment_id,
                    "symbol": order.symbol,
                    "side": order.side,
                    "order_type": order.order_type,
                    "quantity": order.qty,
                    "status": order.status,
                    "fill_price": order.fill_price,
                    "fill_quantity": order.filled_qty if order.filled_qty else None,
                    "is_shadow": order.is_shadow,
                    "phase": order.phase or "week1_shadow",
                    "submitted_at": order.submitted_at,
                    "filled_at": order.filled_at,
                    "risk_note": order.risk_note,
                    "recommendation_id": order.recommendation_id,
                    "broker_order_id": order.broker_order_id,
                }
            ).execute()
        except Exception:
            logger.warning("OrderStore: failed to persist order %s", order.order_id, exc_info=True)

    def _persist_update(self, order_id: str, fields: dict) -> None:
        """Write-through: update existing order in experiment_orders."""
        if not self._db_available:
            return
        client = self._get_client()
        if not client:
            return

        field_map = {
            "status": "status",
            "fill_price": "fill_price",
            "filled_qty": "fill_quantity",
            "filled_at": "filled_at",
            "risk_note": "risk_note",
            "broker_order_id": "broker_order_id",
        }
        db_updates = {}
        for py_field, db_col in field_map.items():
            if py_field in fields:
                db_updates[db_col] = fields[py_field]

        if not db_updates:
            return

        try:
            client.table("experiment_orders").update(db_updates).eq("id", order_id).execute()
        except Exception:
            logger.warning(
                "OrderStore: failed to persist update for %s",
                order_id,
                exc_info=True,
            )


@lru_cache
def get_order_store() -> OrderStore:
    """Singleton order store instance.

    If EXPERIMENT_ID is set, enables DB write-through.
    """
    from src.config import Settings

    settings = Settings()
    experiment_id = settings.experiment_id or None
    supabase_url = settings.supabase_url or None
    supabase_key = settings.supabase_service_role_key or None

    return OrderStore(
        experiment_id=experiment_id,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
    )
