"""Paper trading broker for simulated order execution."""

import random
import uuid

from src.execution.broker_interface import BrokerAdapter, OrderRequest, OrderResult


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
