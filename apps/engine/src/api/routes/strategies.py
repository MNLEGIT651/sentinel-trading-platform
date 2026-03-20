"""Strategy API routes.

Endpoints for listing strategies, running signal scans,
and managing strategy configurations.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.api.routes.data import _get_polygon
from src.db import get_db
from src.strategies.base import OHLCVData

if TYPE_CHECKING:
    from src.data.polygon_client import PolygonClient
from src.strategies.registry import FAMILY_MAP, list_strategies
from src.strategies.signal_generator import SignalGenerator

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/strategies", tags=["strategies"])


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------


class StrategyInfo(BaseModel):
    """Strategy metadata."""

    name: str
    family: str
    description: str
    default_params: dict


class StrategyListResponse(BaseModel):
    """Response for listing available strategies."""

    strategies: list[StrategyInfo]
    families: list[str]
    total: int


class SignalOut(BaseModel):
    """API representation of a trading signal."""

    ticker: str
    direction: str
    strength: float
    strategy_name: str
    reason: str
    metadata: dict = Field(default_factory=dict)


class ScanResponse(BaseModel):
    """Response for a strategy scan run."""

    signals: list[SignalOut]
    total_signals: int
    tickers_scanned: int
    strategies_run: int
    errors: list[str]


class ScanRequest(BaseModel):
    """Request body for running a strategy scan."""

    tickers: list[str] = Field(..., min_length=1, max_length=20)
    days: int = Field(default=90, ge=30, le=365)
    min_strength: float = Field(default=0.3, ge=0.0, le=1.0)
    use_composite: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _fetch_ohlcv(polygon: PolygonClient, ticker: str, days: int) -> OHLCVData | None:
    """Fetch bars from Polygon and convert to OHLCVData."""
    end = date.today()
    start = end - timedelta(days=days)
    bars = await polygon.get_bars(
        ticker=ticker,
        timeframe="1d",
        start=start,
        end=end,
        interactive=True,
    )
    if len(bars) < 20:
        return None
    return OHLCVData(
        ticker=ticker,
        timestamps=np.array([b.timestamp.timestamp() for b in bars], dtype=np.float64),
        open=np.array([b.open for b in bars], dtype=np.float64),
        high=np.array([b.high for b in bars], dtype=np.float64),
        low=np.array([b.low for b in bars], dtype=np.float64),
        close=np.array([b.close for b in bars], dtype=np.float64),
        volume=np.array([b.volume for b in bars], dtype=np.float64),
    )


def _parse_db_timestamp(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _fetch_cached_ohlcv(ticker: str, days: int) -> OHLCVData | None:
    """Load historical OHLCV data from Supabase when available."""
    db = get_db()
    if db is None:
        return None

    instrument = db.table("instruments").select("id").eq("ticker", ticker).maybe_single().execute()
    instrument_row = instrument.data
    if not instrument_row:
        return None

    end = date.today()
    start = end - timedelta(days=days)
    rows = (
        db.table("market_data")
        .select("timestamp,open,high,low,close,volume")
        .eq("instrument_id", instrument_row["id"])
        .eq("timeframe", "1d")
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .order("timestamp")
        .execute()
    )

    if len(rows.data) < 20:
        return None

    return OHLCVData(
        ticker=ticker,
        timestamps=np.array(
            [_parse_db_timestamp(row["timestamp"]).timestamp() for row in rows.data],
            dtype=np.float64,
        ),
        open=np.array([float(row["open"]) for row in rows.data], dtype=np.float64),
        high=np.array([float(row["high"]) for row in rows.data], dtype=np.float64),
        low=np.array([float(row["low"]) for row in rows.data], dtype=np.float64),
        close=np.array([float(row["close"]) for row in rows.data], dtype=np.float64),
        volume=np.array([int(row["volume"]) for row in rows.data], dtype=np.float64),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=StrategyListResponse)
async def get_strategies() -> StrategyListResponse:
    """List all available strategies and families."""
    strategies_data = list_strategies()
    infos = [
        StrategyInfo(
            name=info["name"],
            family=info["family"],
            description=info["description"],
            default_params=info["default_params"],
        )
        for info in strategies_data.values()
    ]
    return StrategyListResponse(
        strategies=infos,
        families=sorted(FAMILY_MAP.keys()),
        total=len(infos),
    )


@router.post("/scan", response_model=ScanResponse)
async def scan_signals(request: ScanRequest) -> ScanResponse:
    """Run strategy scan against live Polygon data for the given tickers."""
    data_map: dict[str, OHLCVData] = {}
    fetch_errors: list[str] = []
    polygon: PolygonClient | None = None
    polygon_error: HTTPException | None = None

    try:
        tickers = [t.strip().upper() for t in request.tickers]
        for i, ticker in enumerate(tickers):
            try:
                cached_ohlcv = _fetch_cached_ohlcv(ticker, request.days)
                if cached_ohlcv:
                    data_map[ticker] = cached_ohlcv
                    continue

                if polygon is None and polygon_error is None:
                    try:
                        polygon = _get_polygon()
                    except HTTPException as exc:
                        polygon_error = exc

                if polygon is None:
                    if polygon_error and not data_map:
                        raise polygon_error
                    fetch_errors.append(f"{ticker}: historical data unavailable in cache")
                    continue

                ohlcv = await _fetch_ohlcv(polygon, ticker, request.days)
                if ohlcv:
                    data_map[ticker] = ohlcv
                else:
                    fetch_errors.append(f"{ticker}: insufficient data (< 20 bars)")
            except HTTPException:
                if not data_map:
                    raise
                fetch_errors.append(f"{ticker}: historical data unavailable")
            except Exception as exc:
                fetch_errors.append(f"{ticker}: {exc}")
            if polygon is not None and i < len(tickers) - 1:
                await asyncio.sleep(0.3)
    finally:
        if polygon is not None:
            await polygon.close()

    if not data_map:
        return ScanResponse(
            signals=[],
            total_signals=0,
            tickers_scanned=0,
            strategies_run=0,
            errors=fetch_errors,
        )

    generator = SignalGenerator(min_signal_strength=request.min_strength)
    if request.use_composite:
        batch = generator.scan_with_composite(data_map)
    else:
        batch = generator.scan(data_map)

    signals_out = [
        SignalOut(
            ticker=s.ticker,
            direction=s.direction.value,
            strength=round(s.strength, 4),
            strategy_name=s.strategy_name,
            reason=s.reason,
            metadata=s.metadata,
        )
        for s in batch.top_signals(50)
    ]

    return ScanResponse(
        signals=signals_out,
        total_signals=batch.total_signals,
        tickers_scanned=batch.tickers_scanned,
        strategies_run=batch.strategies_run,
        errors=fetch_errors + batch.errors,
    )


@router.get("/families/{family}", response_model=StrategyListResponse)
async def get_family_strategies(family: str) -> StrategyListResponse:
    """List strategies in a specific family."""
    if family not in FAMILY_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown family: {family}")

    strategies_data = list_strategies()
    family_names = FAMILY_MAP[family]
    infos = [
        StrategyInfo(
            name=info["name"],
            family=info["family"],
            description=info["description"],
            default_params=info["default_params"],
        )
        for name, info in strategies_data.items()
        if name in family_names
    ]
    return StrategyListResponse(
        strategies=infos,
        families=[family],
        total=len(infos),
    )


@router.get("/{strategy_name}", response_model=StrategyInfo)
async def get_strategy_detail(strategy_name: str) -> StrategyInfo:
    """Get details for a specific strategy."""
    strategies_data = list_strategies()
    if strategy_name not in strategies_data:
        raise HTTPException(status_code=404, detail=f"Unknown strategy: {strategy_name}")

    info = strategies_data[strategy_name]
    return StrategyInfo(
        name=info["name"],
        family=info["family"],
        description=info["description"],
        default_params=info["default_params"],
    )
