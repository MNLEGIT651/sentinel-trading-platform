"""Polygon.io REST API client for fetching OHLCV bars."""

from dataclasses import dataclass
from datetime import date, datetime, timezone

import httpx


@dataclass(frozen=True)
class PolygonBar:
    """A single OHLCV bar from Polygon.io."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: float | None = None


TIMEFRAME_MAP: dict[str, tuple[str, str]] = {
    "1m": ("1", "minute"),
    "5m": ("5", "minute"),
    "15m": ("15", "minute"),
    "1h": ("1", "hour"),
    "1d": ("1", "day"),
    "1w": ("1", "week"),
}


class PolygonClient:
    """Async client for the Polygon.io Aggregates API."""

    BASE_URL = "https://api.polygon.io"

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ValueError("API key is required for Polygon.io")
        self._api_key = api_key
        self._http = httpx.AsyncClient(
            base_url=self.BASE_URL,
            params={"apiKey": api_key},
            timeout=30.0,
        )

    def _map_timeframe(self, timeframe: str) -> tuple[str, str]:
        if timeframe not in TIMEFRAME_MAP:
            raise ValueError(
                f"Invalid timeframe '{timeframe}'. "
                f"Must be one of: {list(TIMEFRAME_MAP.keys())}"
            )
        return TIMEFRAME_MAP[timeframe]

    def _build_bars_url(self, ticker: str, timeframe: str, start: date, end: date) -> str:
        multiplier, span = self._map_timeframe(timeframe)
        return (
            f"/v2/aggs/ticker/{ticker}/range/"
            f"{multiplier}/{span}/{start.isoformat()}/{end.isoformat()}"
        )

    def _parse_bars(self, data: dict) -> list[PolygonBar]:
        results = data.get("results", [])
        bars: list[PolygonBar] = []
        for r in results:
            ts = datetime.fromtimestamp(r["t"] / 1000, tz=timezone.utc)
            bars.append(
                PolygonBar(
                    timestamp=ts,
                    open=float(r["o"]),
                    high=float(r["h"]),
                    low=float(r["l"]),
                    close=float(r["c"]),
                    volume=int(r["v"]),
                    vwap=float(r["vw"]) if "vw" in r else None,
                )
            )
        return bars

    async def get_bars(
        self,
        ticker: str,
        timeframe: str = "1d",
        start: date | None = None,
        end: date | None = None,
        limit: int = 5000,
    ) -> list[PolygonBar]:
        """Fetch OHLCV bars for a ticker from Polygon.io."""
        if start is None:
            start = date(2020, 1, 1)
        if end is None:
            end = date.today()
        url = self._build_bars_url(ticker, timeframe, start, end)
        response = await self._http.get(url, params={"limit": limit, "adjusted": "true"})
        response.raise_for_status()
        return self._parse_bars(response.json())

    async def get_latest_price(self, ticker: str) -> PolygonBar | None:
        """Fetch the previous day's bar for a ticker."""
        response = await self._http.get(f"/v2/aggs/ticker/{ticker}/prev")
        response.raise_for_status()
        bars = self._parse_bars(response.json())
        return bars[0] if bars else None

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()
