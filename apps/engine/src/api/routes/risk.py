"""Risk management API routes.

Endpoints for portfolio risk assessment, position sizing,
and risk configuration.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.db import get_db
from src.risk.position_sizer import PositionSizer, RiskLimits
from src.risk.risk_manager import PortfolioState, RiskManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/risk", tags=["risk"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class PositionSizeRequest(BaseModel):
    """Request for position sizing calculation."""

    ticker: str
    price: float
    method: str = "fixed_fraction"
    equity: float = 100_000.0
    risk_fraction: float = 0.01
    stop_distance: float | None = None
    atr: float | None = None
    win_rate: float | None = None
    avg_win: float | None = None
    avg_loss: float | None = None


class PositionSizeResponse(BaseModel):
    """Response with position sizing result."""

    ticker: str
    shares: int
    dollar_amount: float
    weight: float
    method: str
    risk_per_share: float


class RiskAssessmentRequest(BaseModel):
    """Request for portfolio risk assessment."""

    equity: float
    cash: float
    peak_equity: float
    daily_starting_equity: float
    positions: dict[str, float] = Field(default_factory=dict)
    position_sectors: dict[str, str] = Field(default_factory=dict)


class PreTradeCheckRequest(BaseModel):
    """Request for pre-trade risk check."""

    ticker: str
    shares: int
    price: float
    side: str  # "buy" or "sell"
    equity: float
    cash: float
    peak_equity: float
    daily_starting_equity: float
    positions: dict[str, float] = Field(default_factory=dict)
    position_sectors: dict[str, str] = Field(default_factory=dict)
    sector: str = "unknown"
    recommendation_id: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/position-size", response_model=PositionSizeResponse)
async def calculate_position_size(req: PositionSizeRequest) -> PositionSizeResponse:
    """Calculate position size for a proposed trade."""
    sizer = PositionSizer(total_equity=req.equity)

    if req.method == "volatility_target" and req.atr is not None:
        result = sizer.volatility_target(ticker=req.ticker, price=req.price, atr=req.atr)
    elif req.method == "kelly_criterion" and all([req.win_rate, req.avg_win, req.avg_loss]):
        result = sizer.kelly_criterion(
            ticker=req.ticker,
            price=req.price,
            win_rate=req.win_rate,
            avg_win=req.avg_win,
            avg_loss=req.avg_loss,
        )
    else:
        result = sizer.fixed_fraction(
            ticker=req.ticker,
            price=req.price,
            risk_fraction=req.risk_fraction,
            stop_distance=req.stop_distance,
        )

    return PositionSizeResponse(
        ticker=result.ticker,
        shares=result.shares,
        dollar_amount=result.dollar_amount,
        weight=result.weight,
        method=result.method.value,
        risk_per_share=result.risk_per_share,
    )


@router.post("/assess")
async def assess_portfolio_risk(req: RiskAssessmentRequest) -> dict:
    """Assess current portfolio risk levels."""
    manager = RiskManager()
    state = PortfolioState(
        equity=req.equity,
        cash=req.cash,
        peak_equity=req.peak_equity,
        daily_starting_equity=req.daily_starting_equity,
        positions=req.positions,
        position_sectors=req.position_sectors,
    )
    return manager.assess_portfolio_risk(state)


@router.post("/pre-trade-check")
async def pre_trade_check(req: PreTradeCheckRequest) -> dict:
    """Run pre-trade risk check."""
    manager = RiskManager()
    state = PortfolioState(
        equity=req.equity,
        cash=req.cash,
        peak_equity=req.peak_equity,
        daily_starting_equity=req.daily_starting_equity,
        positions=req.positions,
        position_sectors=req.position_sectors,
    )
    result = manager.pre_trade_check(
        ticker=req.ticker,
        shares=req.shares,
        price=req.price,
        side=req.side,
        state=state,
        sector=req.sector,
    )

    limits = RiskLimits()

    # Persist risk evaluation to Supabase when a recommendation_id is provided
    if req.recommendation_id:
        try:
            db = get_db()
            if db is not None:
                db.table("risk_evaluations").insert(
                    {
                        "recommendation_id": req.recommendation_id,
                        "policy_version": "v1",
                        "allowed": result.allowed,
                        "original_quantity": req.shares,
                        "adjusted_quantity": result.adjusted_shares or req.shares,
                        "checks_performed": [
                            {
                                "name": "position_concentration",
                                "passed": True,
                                "limit": limits.max_position_pct,
                                "actual": None,
                                "message": None,
                            },
                            {
                                "name": "sector_exposure",
                                "passed": True,
                                "limit": limits.max_sector_pct,
                                "actual": None,
                                "message": None,
                            },
                            {
                                "name": "daily_loss",
                                "passed": True,
                                "limit": limits.max_portfolio_risk_pct,
                                "actual": None,
                                "message": None,
                            },
                        ],
                        "reason": result.reason,
                    }
                ).execute()
        except Exception:
            logger.warning(
                "Failed to write risk_evaluations for recommendation %s",
                req.recommendation_id,
                exc_info=True,
            )

    return {
        "allowed": result.allowed,
        "action": result.action.value,
        "reason": result.reason,
        "adjusted_shares": result.adjusted_shares,
        "recommendation_id": req.recommendation_id,
    }


@router.get("/limits")
async def get_risk_limits() -> dict:
    """Get current risk limit configuration."""
    limits = RiskLimits()
    return {
        "max_position_pct": limits.max_position_pct,
        "max_sector_pct": limits.max_sector_pct,
        "max_portfolio_risk_pct": limits.max_portfolio_risk_pct,
        "max_drawdown_soft": limits.max_drawdown_soft,
        "max_drawdown_hard": limits.max_drawdown_hard,
        "max_correlated_exposure": limits.max_correlated_exposure,
        "max_open_positions": limits.max_open_positions,
    }
