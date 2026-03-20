"""Abstract broker adapter interface for order execution."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class OrderRequest:
    """Represents an order to be submitted to a broker."""

    instrument_id: str
    side: str  # "buy" | "sell"
    order_type: str  # "market" | "limit" | "stop" | "stop_limit"
    quantity: float
    limit_price: float | None = None
    stop_price: float | None = None


@dataclass(frozen=True)
class OrderResult:
    """Represents the outcome of a submitted order."""

    order_id: str
    status: str  # "filled" | "rejected" | "cancelled" | "pending"
    fill_price: float | None = None
    fill_quantity: float | None = None
    commission: float = 0.0
    slippage: float | None = None


class BrokerAdapter(ABC):
    """Abstract base class for broker adapters."""

    @abstractmethod
    async def submit_order(self, order: OrderRequest, **kwargs) -> OrderResult:
        """Submit an order to the broker."""
        ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> None:
        """Cancel an existing order."""
        ...

    @abstractmethod
    async def get_positions(self) -> list[dict]:
        """Get all current positions."""
        ...

    @abstractmethod
    async def get_account(self) -> dict:
        """Get account summary (cash, equity, etc.)."""
        ...

    @abstractmethod
    async def get_orders(self, status: str = "open") -> list[dict]:
        """Get orders filtered by status."""
        ...
