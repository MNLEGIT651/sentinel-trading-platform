"""Data ingestion and live market data API routes."""

import logging
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.config import Settings
from src.data.polygon_client import PolygonClient
from src.db import get_db

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
async def ingest_data(request: IngestRequest) -> IngestResponse:
    """Trigger data ingestion for the given tickers (requires Supabase)."""
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.",
        )

    from src.data.ingestion import DataIngestionService

    polygon = _get_polygon()
    service = DataIngestionService(polygon=polygon, db=db)
    result = await service.ingest_batch(tickers=request.tickers, timeframe=request.timeframe)
    return IngestResponse(ingested=result.ingested, errors=result.errors)


@router.get("/quote/{ticker}", response_model=MarketQuote)
async def get_quote(ticker: str) -> MarketQuote:
    """Fetch the latest price for a ticker from Polygon.io."""
    polygon = _get_polygon()
    try:
        bar = await polygon.get_latest_price(ticker.upper(), interactive=True)
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

    Uses fast-fail interactive requests and cached fallbacks so browser traffic
    does not stall behind long provider backoff cycles.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    polygon = _get_polygon()
    quotes: list[MarketQuote] = []
    try:
        for ticker in ticker_list:
            try:
                bar = await polygon.get_latest_price(ticker, interactive=True)
                if bar:
                    quotes.append(_bar_to_quote(ticker, bar))
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429:
                    logger.warning("Rate limited fetching %s, skipping remaining tickers", ticker)
                    break
                logger.warning("Failed to fetch %s: %s", ticker, exc)
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
            ticker=ticker.upper(),
            timeframe=timeframe,
            start=start,
            end=end,
            interactive=True,
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
