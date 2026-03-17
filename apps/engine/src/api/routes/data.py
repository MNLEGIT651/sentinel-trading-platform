"""Data ingestion and live market data API routes."""

import asyncio
import logging
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from starlette.requests import Request

from src.api.limiter import limiter
from src.config import Settings
from src.data.ingestion import DataIngestionService
from src.data.polygon_client import PolygonClient
from src.db import get_db
from src.utils.circuit_breaker import with_circuit_breaker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["data"])


class IngestRequest(BaseModel):
    """Request body for data ingestion."""

    tickers: list[str] = Field(..., min_length=1)
    timeframe: str = "1d"


class IngestResponse(BaseModel):
    """Response body for data ingestion."""

    ingested: int
    errors: list[str]


class MarketQuote(BaseModel):
    """A single ticker's latest price data."""

    ticker: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: float | None = None
    timestamp: str
    change: float = 0.0
    change_pct: float = 0.0


class MarketBar(BaseModel):
    """A single OHLCV bar."""

    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: float | None = None


def _bar_to_quote(ticker: str, bar) -> MarketQuote:
    """Convert a PolygonBar to a MarketQuote response."""
    return MarketQuote(
        ticker=ticker,
        open=bar.open,
        high=bar.high,
        low=bar.low,
        close=bar.close,
        volume=bar.volume,
        vwap=bar.vwap,
        timestamp=bar.timestamp.isoformat(),
        change=round(bar.close - bar.open, 2),
        change_pct=round(((bar.close - bar.open) / bar.open) * 100, 2) if bar.open else 0,
    )


def _get_polygon() -> PolygonClient:
    """Create a PolygonClient or raise 503."""
    settings = Settings()
    if not settings.polygon_api_key:
        raise HTTPException(status_code=503, detail="POLYGON_API_KEY not set.")
    return PolygonClient(api_key=settings.polygon_api_key)


@router.post("/ingest", response_model=IngestResponse)
@limiter.limit("5/minute")
async def ingest_data(request: Request, body: IngestRequest) -> IngestResponse:
    """Trigger data ingestion for the given tickers (requires Supabase)."""
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.",
        )

    settings = Settings()
    polygon = PolygonClient(api_key=settings.polygon_api_key)
    service = DataIngestionService(polygon=polygon, db=db)
    result = await service.ingest_batch(tickers=body.tickers, timeframe=body.timeframe)
    return IngestResponse(ingested=result.ingested, errors=result.errors)


@router.get("/quote/{ticker}", response_model=MarketQuote)
async def get_quote(ticker: str) -> MarketQuote:
    """Fetch the latest price for a ticker from Polygon.io."""
    polygon = _get_polygon()
    try:
        bar = await with_circuit_breaker(lambda: polygon.get_latest_price(ticker.upper()))
        if not bar:
            raise HTTPException(status_code=404, detail=f"No data for {ticker}")
        return _bar_to_quote(ticker.upper(), bar)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise HTTPException(
                status_code=429, detail="Polygon rate limit exceeded. Try again shortly."
            )
        raise
    finally:
        await polygon.close()


@router.get("/quotes", response_model=list[MarketQuote])
async def get_quotes(tickers: str = "AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META,SPY") -> list[MarketQuote]:
    """Fetch latest prices for multiple tickers (comma-separated).

    Uses a small inter-request delay to stay within free-tier rate limits.
    Skips tickers that fail rather than aborting the whole batch.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    polygon = _get_polygon()
    quotes: list[MarketQuote] = []
    try:
        for i, ticker in enumerate(ticker_list):
            try:
                bar = await polygon.get_latest_price(ticker)
                if bar:
                    quotes.append(_bar_to_quote(ticker, bar))
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429:
                    logger.warning("Rate limited fetching %s, skipping remaining tickers", ticker)
                    break
                logger.warning("Failed to fetch %s: %s", ticker, exc)
            # Stagger requests to avoid 429s on free tier (5 req/min)
            if i < len(ticker_list) - 1:
                await asyncio.sleep(0.5)
    finally:
        await polygon.close()

    return quotes


@router.get("/bars/{ticker}", response_model=list[MarketBar])
async def get_bars(
    ticker: str,
    timeframe: str = "1d",
    days: int = 90,
) -> list[MarketBar]:
    """Fetch historical OHLCV bars from Polygon.io."""
    polygon = _get_polygon()
    try:
        end = date.today()
        start = end - timedelta(days=days)
        bars = await polygon.get_bars(
            ticker=ticker.upper(), timeframe=timeframe, start=start, end=end
        )
        return [
            MarketBar(
                timestamp=b.timestamp.isoformat(),
                open=b.open,
                high=b.high,
                low=b.low,
                close=b.close,
                volume=b.volume,
                vwap=b.vwap,
            )
            for b in bars
        ]
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise HTTPException(
                status_code=429, detail="Polygon rate limit exceeded. Try again shortly."
            )
        raise
    finally:
        await polygon.close()
