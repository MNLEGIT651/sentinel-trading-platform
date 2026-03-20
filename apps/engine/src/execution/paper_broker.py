"""Paper trading broker for simulated order execution."""

import random
import uuid
from datetime import UTC, datetime

from src.execution.broker_interface import BrokerAdapter, OrderRequest, OrderResult
from src.execution.order_store import StoredOrder, get_order_store


class PaperBroker(BrokerAdapter):
    """Simulated broker for paper trading with slippage modeling."""

    def __init__(
        self,
        initial_capital: float = 100_000.0,
        slippage_bps: float = 5.0,
    ) -> None:
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.positions: dict[str, dict] = {}  # instrument_id -> {quantity, avg_price}
        self.slippage_bps = slippage_bps
        self._orders: dict[str, OrderRequest] = {}  # order_id -> request

    def _apply_slippage(self, price: float, side: str) -> float:
        """Apply random slippage between 0 and slippage_bps basis points."""
        slip_fraction = random.uniform(0, self.slippage_bps) / 10_000
        if side == "buy":
            return price * (1 + slip_fraction)
        else:
            return price * (1 - slip_fraction)

    async def submit_order(self, order: OrderRequest, **kwargs) -> OrderResult:
        """Execute a paper order. Requires current_price kwarg."""
        current_price = kwargs.get("current_price")
        if current_price is None:
            raise ValueError("PaperBroker requires 'current_price' kwarg")

        order_id = str(uuid.uuid4())
        fill_price = self._apply_slippage(current_price, order.side)
        slippage = abs(fill_price - current_price)
        cost = fill_price * order.quantity

        if order.side == "buy":
            if cost > self.cash:
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
            self.cash -= cost
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
            self.cash += cost

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
