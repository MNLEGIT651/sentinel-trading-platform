"""Pydantic response models for all engine API routes.

Provides:
- ``EngineResponse[T]`` — standard generic envelope (matches
  ``EngineResponse<T>`` in ``packages/shared/src/types.ts``).
- Concrete data models for every route that previously returned a raw dict.

Routes that already ship their own Pydantic model (data.py, strategies.py,
backtest.py ``/run``) keep using those models directly so the wire format
does not change.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic envelope — matches packages/shared/src/types.ts EngineResponse<T>
# ---------------------------------------------------------------------------


class EngineResponse(BaseModel, Generic[T]):
    """Standard API envelope.

    Available for future migration of all endpoints to a uniform shape.
    """

    success: bool
    data: T | None = None
    error: str | None = None
    timestamp: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat(),
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class DependencyStatus(BaseModel):
    polygon: bool
    alpaca: bool
    supabase: bool


class HealthResponse(BaseModel):
    status: str
    service: str
    dependencies: DependencyStatus


# ---------------------------------------------------------------------------
# Portfolio — Account
# ---------------------------------------------------------------------------


class AccountResponse(BaseModel):
    """Broker account summary.

    AlpacaBroker returns all fields; PaperBroker omits optional ones.
    """

    account_id: str | None = None
    status: str | None = None
    cash: float
    positions_value: float
    equity: float
    buying_power: float | None = None
    initial_capital: float | None = None
    pattern_day_trader: bool | None = None
    day_trade_count: int | None = None
    currency: str | None = None


# ---------------------------------------------------------------------------
# Portfolio — Positions
# ---------------------------------------------------------------------------


class PositionResponse(BaseModel):
    """A single open position."""

    instrument_id: str
    quantity: float
    avg_price: float
    market_value: float | None = None
    current_price: float | None = None
    unrealized_pl: float | None = None
    unrealized_plpc: float | None = None
    side: str | None = None


# ---------------------------------------------------------------------------
# Portfolio — Orders
# ---------------------------------------------------------------------------


class OrderResponse(BaseModel):
    """An order as returned by the broker."""

    order_id: str
    symbol: str
    side: str
    type: str
    qty: float
    filled_qty: float
    status: str
    submitted_at: str
    filled_avg_price: float | None = None


class OrderSubmitResponse(BaseModel):
    """Result of submitting a new order."""

    order_id: str
    status: str
    fill_price: float | None = None
    fill_quantity: float | None = None
    commission: float | None = None
    slippage: float | None = None
    risk_note: str | None = None


class StoredOrderResponse(BaseModel):
    """An order from the in-memory order history store."""

    order_id: str
    symbol: str
    side: str
    order_type: str
    qty: float
    filled_qty: float
    status: str
    fill_price: float | None = None
    submitted_at: str
    filled_at: str | None = None
    risk_note: str | None = None


class CancelOrderResponse(BaseModel):
    """Acknowledgement of a cancelled order."""

    status: str
    order_id: str


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------


class RiskAlert(BaseModel):
    severity: str
    rule: str
    message: str
    action: str


class RiskAssessmentResponse(BaseModel):
    """Result of a portfolio risk assessment."""

    equity: float
    cash: float
    cash_pct: float
    invested_pct: float
    drawdown: float
    daily_pnl: float
    position_count: int
    concentrations: dict[str, float]
    sector_concentrations: dict[str, float]
    alerts: list[RiskAlert]
    halted: bool


class PreTradeCheckResponse(BaseModel):
    """Result of a pre-trade risk check."""

    allowed: bool
    action: str
    reason: str
    adjusted_shares: int | None = None
    recommendation_id: str | None = None


class RiskLimitsResponse(BaseModel):
    """Current risk limit configuration."""

    max_position_pct: float
    max_sector_pct: float
    max_portfolio_risk_pct: float
    max_drawdown_soft: float
    max_drawdown_hard: float
    max_correlated_exposure: float
    max_open_positions: int


# ---------------------------------------------------------------------------
# Backtest
# ---------------------------------------------------------------------------


class BacktestableStrategiesResponse(BaseModel):
    """Strategies available for backtesting."""

    strategies: list[str]
    trends: list[str]
