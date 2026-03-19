"""Tests for the Polygon.io API client."""

from datetime import UTC, date, datetime

import pytest

from src.data.polygon_client import TIMEFRAME_MAP, PolygonClient


class TestPolygonClientInit:
    def test_requires_api_key(self):
        with pytest.raises(ValueError, match="API key is required"):
            PolygonClient(api_key="")

    def test_accepts_valid_api_key(self):
        client = PolygonClient(api_key="test-key")
        assert client._api_key == "test-key"


class TestMapTimeframe:
    def test_valid_timeframes(self):
        client = PolygonClient(api_key="test-key")
        for tf, expected in TIMEFRAME_MAP.items():
            assert client._map_timeframe(tf) == expected

    def test_invalid_timeframe_raises(self):
        client = PolygonClient(api_key="test-key")
        with pytest.raises(ValueError, match="Invalid timeframe '2d'"):
            client._map_timeframe("2d")


class TestBuildBarsUrl:
    def test_url_format(self):
        client = PolygonClient(api_key="test-key")
        url = client._build_bars_url("AAPL", "1d", date(2024, 1, 1), date(2024, 6, 30))
        assert url == "/v2/aggs/ticker/AAPL/range/1/day/2024-01-01/2024-06-30"

    def test_url_format_minute(self):
        client = PolygonClient(api_key="test-key")
        url = client._build_bars_url("SPY", "5m", date(2024, 3, 1), date(2024, 3, 2))
        assert url == "/v2/aggs/ticker/SPY/range/5/minute/2024-03-01/2024-03-02"

    def test_url_format_weekly(self):
        client = PolygonClient(api_key="test-key")
        url = client._build_bars_url("MSFT", "1w", date(2024, 1, 1), date(2024, 12, 31))
        assert url == "/v2/aggs/ticker/MSFT/range/1/week/2024-01-01/2024-12-31"


class TestParseBars:
    def test_parses_valid_data(self):
        client = PolygonClient(api_key="test-key")
        data = {
            "results": [
                {
                    "t": 1704067200000,  # 2024-01-01 00:00:00 UTC
                    "o": 150.0,
                    "h": 155.0,
                    "l": 149.0,
                    "c": 153.0,
                    "v": 1000000,
                    "vw": 152.5,
                },
                {
                    "t": 1704153600000,  # 2024-01-02 00:00:00 UTC
                    "o": 153.0,
                    "h": 157.0,
                    "l": 152.0,
                    "c": 156.0,
                    "v": 1200000,
                },
            ]
        }
        bars = client._parse_bars(data)
        assert len(bars) == 2

        assert bars[0].timestamp == datetime(2024, 1, 1, tzinfo=UTC)
        assert bars[0].open == 150.0
        assert bars[0].high == 155.0
        assert bars[0].low == 149.0
        assert bars[0].close == 153.0
        assert bars[0].volume == 1000000
        assert bars[0].vwap == 152.5

        # Second bar has no vwap
        assert bars[1].vwap is None

    def test_parses_empty_results(self):
        client = PolygonClient(api_key="test-key")
        bars = client._parse_bars({"results": []})
        assert bars == []

    def test_parses_missing_results_key(self):
        client = PolygonClient(api_key="test-key")
        bars = client._parse_bars({"status": "OK"})
        assert bars == []
