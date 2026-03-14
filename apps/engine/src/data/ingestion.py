"""Data ingestion orchestrator: fetches from Polygon and upserts to Supabase."""

import logging
from dataclasses import dataclass, field
from datetime import date

from src.data.polygon_client import PolygonBar, PolygonClient

logger = logging.getLogger(__name__)


@dataclass
class IngestionResult:
    """Tracks the outcome of an ingestion run."""

    ingested: int = 0
    errors: list[str] = field(default_factory=list)


class DataIngestionService:
    """Orchestrates fetching market data and persisting it."""

    def __init__(self, polygon: PolygonClient, db) -> None:
        self._polygon = polygon
        self._db = db

    def _resolve_instrument_id(self, ticker: str) -> str | None:
        result = self._db.table("instruments").select("id").eq("ticker", ticker).execute()
        if result.data:
            return result.data[0]["id"]
        return None

    def _bars_to_rows(
        self, bars: list[PolygonBar], instrument_id: str, timeframe: str
    ) -> list[dict]:
        return [
            {
                "instrument_id": instrument_id,
                "timestamp": bar.timestamp.isoformat(),
                "timeframe": timeframe,
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
                "vwap": bar.vwap,
                "adjusted_close": bar.close,
                "source": "polygon",
            }
            for bar in bars
        ]

    async def ingest_ticker(
        self,
        ticker: str,
        timeframe: str = "1d",
        start: date | None = None,
        end: date | None = None,
    ) -> IngestionResult:
        """Ingest OHLCV data for a single ticker."""
        result = IngestionResult()
        try:
            instrument_id = self._resolve_instrument_id(ticker)
            if not instrument_id:
                result.errors.append(f"Instrument not found: {ticker}")
                return result

            bars = await self._polygon.get_bars(
                ticker=ticker, timeframe=timeframe, start=start, end=end
            )
            if not bars:
                return result

            rows = self._bars_to_rows(bars, instrument_id, timeframe)
            self._db.table("market_data").upsert(
                rows, on_conflict="instrument_id,timestamp,timeframe"
            ).execute()
            result.ingested = len(rows)
            logger.info(f"Ingested {len(rows)} bars for {ticker} ({timeframe})")
        except Exception as e:
            result.errors.append(f"Failed to ingest {ticker}: {e}")
            logger.error(f"Failed to ingest {ticker}: {e}")
        return result

    async def ingest_batch(
        self,
        tickers: list[str],
        timeframe: str = "1d",
        start: date | None = None,
        end: date | None = None,
    ) -> IngestionResult:
        """Ingest OHLCV data for multiple tickers sequentially."""
        combined = IngestionResult()
        for ticker in tickers:
            r = await self.ingest_ticker(ticker, timeframe, start, end)
            combined.ingested += r.ingested
            combined.errors.extend(r.errors)
        return combined
