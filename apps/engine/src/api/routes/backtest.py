"""Backtest API routes.

Endpoints for running strategy backtests against historical data.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.backtest.engine import BacktestEngine
from src.strategies.base import OHLCVData
from src.strategies.registry import STRATEGY_CLASSES, create_strategy

router = APIRouter(prefix="/backtest", tags=["backtest"])


class BacktestRequest(BaseModel):
    """Request to run a backtest."""

    strategy_name: str
    ticker: str = "SYNTHETIC"
    bars: int = Field(default=252, ge=50, le=5000)
    initial_capital: float = 100_000.0
    commission_per_share: float = 0.005
    slippage_pct: float = 0.001
    position_size_pct: float = 0.10
    trend: str = Field(default="random", pattern="^(up|down|volatile|random)$")
    seed: int = 42


class BacktestSummary(BaseModel):
    """Concise backtest result."""

    strategy: str
    ticker: str
    total_return: str
    annualized_return: str
    max_drawdown: str
    sharpe_ratio: str
    sortino_ratio: str
    win_rate: str
    profit_factor: str
    total_trades: int
    avg_holding_bars: str


class TradeOut(BaseModel):
    """Individual trade record from backtest."""

    side: str
    entry_bar: int
    exit_bar: int
    entry_price: float
    exit_price: float
    pnl: float
    return_pct: float


class BacktestResponse(BaseModel):
    """Full backtest result."""

    summary: BacktestSummary
    equity_curve: list[float]
    drawdown_curve: list[float]
    trade_count: int
    trades: list[TradeOut]


def generate_synthetic_data(
    ticker: str,
    n: int,
    trend: str,
    seed: int,
) -> OHLCVData:
    """Generate synthetic OHLCV data for backtesting."""
    rng = np.random.default_rng(seed)

    if trend == "up":
        base = 100 + np.linspace(0, 50, n) + np.cumsum(rng.normal(0, 0.5, n))
    elif trend == "down":
        base = 150 - np.linspace(0, 50, n) + np.cumsum(rng.normal(0, 0.5, n))
    elif trend == "volatile":
        base = 100 + 15 * np.sin(np.linspace(0, 8 * np.pi, n)) + np.cumsum(rng.normal(0, 0.8, n))
    else:  # random
        base = 100 + np.cumsum(rng.normal(0.02, 1.5, n))

    close = np.maximum(base, 10.0).astype(np.float64)
    high = (close + rng.uniform(0.5, 3.0, n)).astype(np.float64)
    low = (close - rng.uniform(0.5, 3.0, n)).astype(np.float64)
    open_ = (close + rng.normal(0, 0.5, n)).astype(np.float64)
    volume = rng.uniform(1e6, 5e6, n).astype(np.float64)
    timestamps = np.arange(n, dtype=np.float64)

    return OHLCVData(
        ticker=ticker,
        timestamps=timestamps,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


@router.post("/run", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest) -> BacktestResponse:
    """Run a backtest with synthetic data."""
    if req.strategy_name not in STRATEGY_CLASSES:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown strategy: {req.strategy_name}. "
                f"Available: {sorted(STRATEGY_CLASSES.keys())}"
            ),
        )

    strategy = create_strategy(req.strategy_name)
    data = generate_synthetic_data(req.ticker, req.bars, req.trend, req.seed)

    engine = BacktestEngine(
        initial_capital=req.initial_capital,
        commission_per_share=req.commission_per_share,
        slippage_pct=req.slippage_pct,
        position_size_pct=req.position_size_pct,
    )

    result = engine.run(strategy, data)
    summary = result.summary()

    return BacktestResponse(
        summary=BacktestSummary(**summary),
        equity_curve=result.equity_curve.equity.tolist(),
        drawdown_curve=result.equity_curve.drawdown.tolist(),
        trade_count=result.total_trades,
        trades=[
            TradeOut(
                side=t.side,
                entry_bar=int(t.entry_bar),
                exit_bar=int(t.exit_bar),
                entry_price=float(t.entry_price),
                exit_price=float(t.exit_price),
                pnl=float(t.pnl),
                return_pct=float(t.pnl_pct),
            )
            for t in result.trades
        ],
    )


@router.get("/strategies")
async def list_backtestable_strategies() -> dict:
    """List strategies available for backtesting."""
    return {
        "strategies": sorted(STRATEGY_CLASSES.keys()),
        "trends": ["up", "down", "volatile", "random"],
    }
