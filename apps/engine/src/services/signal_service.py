"""Signal scanning service — extracted from strategies routes.

Separates DB record management, market data fetching, and signal generation
into discrete functions so the route handler stays thin.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fastapi import HTTPException

from src.api.routes.data import _get_polygon
from src.strategies.base import OHLCVData
from src.strategies.registry import list_strategies
from src.strategies.signal_generator import SignalBatch, SignalGenerator

if TYPE_CHECKING:
    from supabase import Client as SupabaseClient

    from src.data.polygon_client import PolygonClient

logger = logging.getLogger(__name__)


async def create_signal_run(
    db: SupabaseClient,
    tickers: list[str],
    days: int,
    min_strength: float,
) -> str | None:
    """Create a signal_run record in the database. Returns the run ID or None."""
    try:
        strategy_names = list(list_strategies().keys())
        result = (
            db.table("signal_runs")
            .insert(
                {
                    "requested_by": "api",
                    "universe": tickers,
                    "strategies": strategy_names,
                    "days": days,
                    "min_strength": float(min_strength),
                    "status": "running",
                }
            )
            .select("id")
            .single()
            .execute()
        )
        raw_id = result.data["id"] if result.data else None
        return str(raw_id) if raw_id is not None else None
    except Exception as exc:
        logger.warning("Failed to create signal_run record: %s", exc)
        return None


async def fetch_market_data(
    tickers: list[str],
    days: int,
    fetch_cached_fn,  # callable type varies
    fetch_polygon_fn,
) -> tuple[dict[str, OHLCVData], list[str]]:
    """Fetch OHLCV data for each ticker, trying cache first then Polygon.

    Returns (data_map, fetch_errors).
    """
    data_map: dict[str, OHLCVData] = {}
    fetch_errors: list[str] = []
    polygon: PolygonClient | None = None
    polygon_error: HTTPException | None = None

    try:
        for i, ticker in enumerate(tickers):
            try:
                cached_ohlcv = fetch_cached_fn(ticker, days)
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

                ohlcv = await fetch_polygon_fn(polygon, ticker, days)
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

    return data_map, fetch_errors


def generate_signals(
    data_map: dict[str, OHLCVData],
    min_strength: float,
    use_composite: bool,
) -> SignalBatch:
    """Run the signal generator over fetched market data."""
    generator = SignalGenerator(min_signal_strength=min_strength)
    if use_composite:
        return generator.scan_with_composite(data_map)
    return generator.scan(data_map)


async def complete_signal_run(
    db: SupabaseClient,
    run_id: str,
    *,
    total_signals: int,
    status: str,
    errors: list[str],
) -> None:
    """Update the signal_run record with final results."""
    try:
        db.table("signal_runs").update(
            {
                "finished_at": datetime.now(UTC).isoformat(),
                "total_signals": total_signals,
                "status": status,
                "errors": errors,
            }
        ).eq("id", run_id).execute()
    except Exception as exc:
        logger.warning("Failed to update signal_run record: %s", exc)
