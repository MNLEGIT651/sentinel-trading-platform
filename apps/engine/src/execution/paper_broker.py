"""Paper trading broker for simulated order execution."""

import asyncio
import logging
import random
import uuid
from datetime import UTC, datetime

from src.execution.broker_interface import BrokerAdapter, OrderRequest, OrderResult
from src.execution.order_store import StoredOrder, get_order_store

logger = logging.getLogger(__name__)

# ── Realistic defaults ────────────────────────────────────────────────────
_COMMISSION_PER_SHARE: float = 0.005  # $0.005 / share (industry average)
_PDT_EQUITY_THRESHOLD: float = 25_000.0  # FINRA pattern day-trader threshold
_PDT_MAX_DAY_TRADES: int = 3  # max day-trades in 5 rolling business days
_FILL_LATENCY_MIN_MS: int = 50  # realistic fill delay lower bound
_FILL_LATENCY_MAX_MS: int = 200  # realistic fill delay upper bound


class PaperBroker(BrokerAdapter):
    """Simulated broker for paper trading with realistic execution modeling.

    Includes:
    * Slippage modeling (random within ``slippage_bps``)
    * Per-share commission ($0.005/share)
    * Pattern day-trade (PDT) tracking for accounts < $25 000
    * Configurable fill latency (50-200 ms)
    """

    def __init__(
        self,
        initial_capital: float = 100_000.0,
        slippage_bps: float = 5.0,
        commission_per_share: float = _COMMISSION_PER_SHARE,
        fill_latency_range_ms: tuple[int, int] = (
            _FILL_LATENCY_MIN_MS,
            _FILL_LATENCY_MAX_MS,
        ),
    ) -> None:
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.positions: dict[str, dict] = {}  # instrument_id -> {quantity, avg_price}
        self.slippage_bps = slippage_bps
        self.commission_per_share = commission_per_share
        self.fill_latency_range_ms = fill_latency_range_ms
        self._orders: dict[str, OrderRequest] = {}  # order_id -> request
        # PDT tracking: list of (instrument_id, trade_date)
        self._day_trades: list[tuple[str, str]] = []
        # Track buy dates per instrument for same-day round-trip detection
        self._open_dates: dict[str, list[str]] = {}

    def _apply_slippage(self, price: float, side: str) -> float:
        """Apply random slippage between 0 and slippage_bps basis points."""
        slip_fraction = random.uniform(0, self.slippage_bps) / 10_000
        if side == "buy":
            return price * (1 + slip_fraction)
        else:
            return price * (1 - slip_fraction)

    def _track_day_trade(self, order: OrderRequest) -> None:
        """Record a potential day-trade (open+close same instrument same day).

        A day-trade occurs when a position in the same instrument is opened
        and closed on the same calendar day.  We track buy timestamps per
        instrument and check sells against them.

        Logs a warning if account equity is below the PDT threshold and the
        rolling 5-business-day day-trade count reaches the limit.
        """
        today = datetime.now(UTC).strftime("%Y-%m-%d")

        if order.side == "buy":
            # Record the buy date for the instrument
            self._open_dates.setdefault(order.instrument_id, []).append(today)
            return

        if order.side == "sell":
            # Check if there was a buy for this instrument today
            open_dates = self._open_dates.get(order.instrument_id, [])
            if today in open_dates:
                # Same-day round-trip → day trade
                open_dates.remove(today)
                self._day_trades.append((order.instrument_id, today))
                # Prune entries older than 5 business days (~7 calendar days
                # is conservative; real PDT uses rolling 5 *business* days)
                cutoff = datetime.now(UTC)
                self._day_trades = [
                    (sym, dt)
                    for sym, dt in self._day_trades
                    if (cutoff - datetime.fromisoformat(dt).replace(tzinfo=UTC)).days <= 7
                ]
                equity = self.cash + sum(
                    abs(p["quantity"]) * p["avg_price"] for p in self.positions.values()
                )
                if equity < _PDT_EQUITY_THRESHOLD and len(self._day_trades) >= _PDT_MAX_DAY_TRADES:
                    logger.warning(
                        "PDT warning: %d day-trades in rolling window with equity $%.2f (< $%.2f)",
                        len(self._day_trades),
                        equity,
                        _PDT_EQUITY_THRESHOLD,
                    )

    async def submit_order(self, order: OrderRequest, **kwargs) -> OrderResult:
        """Execute a paper order with realistic modeling.

        Requires ``current_price`` kwarg.  Applies slippage, per-share
        commission, PDT checks and configurable fill latency.
        """
        current_price = kwargs.get("current_price")
        if current_price is None:
            raise ValueError("PaperBroker requires 'current_price' kwarg")

        order_id = str(uuid.uuid4())

        # ── Fill latency ─────────────────────────────────────────────────
        lo, hi = self.fill_latency_range_ms
        if hi > 0:
            delay_s = random.randint(lo, hi) / 1000.0
            await asyncio.sleep(delay_s)

        fill_price = self._apply_slippage(current_price, order.side)
        slippage = abs(fill_price - current_price)
        commission = self.commission_per_share * order.quantity
        cost = fill_price * order.quantity

        if order.side == "buy":
            total_cost = cost + commission
            if total_cost > self.cash:
                get_order_store().add(
                    StoredOrder(
                        order_id=order_id,
                        symbol=order.instrument_id,
                        side=order.side,
                        order_type=order.order_type,
                        qty=order.quantity,
                        filled_qty=0,
                        status="rejected",
                        fill_price=None,
                        submitted_at=datetime.now(UTC).isoformat(),
                        filled_at=None,
                        risk_note="Insufficient cash",
                    )
                )
                return OrderResult(
                    order_id=order_id,
                    status="rejected",
                    fill_price=None,
                    fill_quantity=None,
                    slippage=None,
                )
            self.cash -= total_cost
            pos = self.positions.get(order.instrument_id)
            if pos:
                total_qty = pos["quantity"] + order.quantity
                pos["avg_price"] = (
                    (pos["avg_price"] * pos["quantity"]) + (fill_price * order.quantity)
                ) / total_qty
                pos["quantity"] = total_qty
            else:
                self.positions[order.instrument_id] = {
                    "quantity": order.quantity,
                    "avg_price": fill_price,
                }
        elif order.side == "sell":
            pos = self.positions.get(order.instrument_id)
            if pos:
                pos["quantity"] -= order.quantity
                if pos["quantity"] == 0:
                    del self.positions[order.instrument_id]
                elif pos["quantity"] < 0:
                    # Short position: keep the negative quantity, update avg_price
                    pos["avg_price"] = fill_price
            else:
                # Opening a short position
                self.positions[order.instrument_id] = {
                    "quantity": -order.quantity,
                    "avg_price": fill_price,
                }
            self.cash += cost - commission

        # ── PDT tracking ─────────────────────────────────────────────────
        self._track_day_trade(order)

        self._orders[order_id] = order
        now = datetime.now(UTC).isoformat()
        get_order_store().add(
            StoredOrder(
                order_id=order_id,
                symbol=order.instrument_id,
                side=order.side,
                order_type=order.order_type,
                qty=order.quantity,
                filled_qty=order.quantity,
                status="filled",
                fill_price=fill_price,
                submitted_at=now,
                filled_at=now,
                risk_note=None,
            )
        )
        return OrderResult(
            order_id=order_id,
            status="filled",
            fill_price=fill_price,
            fill_quantity=order.quantity,
            slippage=slippage,
        )

    async def cancel_order(self, order_id: str) -> None:
        """Cancel an order by ID. Raises ValueError if not found."""
        if order_id not in self._orders:
            raise ValueError(f"Order not found: {order_id}")
        del self._orders[order_id]
        get_order_store().update(order_id, status="cancelled")

    async def get_orders(self, status: str = "open") -> list[dict]:
        """Get orders from the order store."""
        store = get_order_store()
        status_filter = None if status == "all" else status
        orders = store.list_orders(status=status_filter)
        return [
            {
                "order_id": o.order_id,
                "symbol": o.symbol,
                "side": o.side,
                "type": o.order_type,
                "qty": o.qty,
                "filled_qty": o.filled_qty,
                "status": o.status,
                "submitted_at": o.submitted_at,
                "filled_avg_price": o.fill_price,
            }
            for o in orders
        ]

    async def get_positions(self) -> list[dict]:
        """Return all open positions as a list of dicts."""
        return [
            {
                "instrument_id": inst_id,
                "quantity": pos["quantity"],
                "avg_price": pos["avg_price"],
            }
            for inst_id, pos in self.positions.items()
        ]

    async def get_account(self) -> dict:
        """Return account summary with cash, positions value, and equity."""
        positions_value = sum(
            abs(pos["quantity"]) * pos["avg_price"] for pos in self.positions.values()
        )
        return {
            "cash": self.cash,
            "positions_value": positions_value,
            "equity": self.cash + positions_value,
            "initial_capital": self.initial_capital,
        }
