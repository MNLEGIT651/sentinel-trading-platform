"""Tests for strategy API routes."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from src.api.main import _settings, app
from src.data.polygon_client import PolygonBar


@pytest.fixture
def client():
    c = TestClient(app)
    c.headers["X-API-Key"] = _settings.engine_api_key
    return c


class TestListStrategies:
    def test_returns_all_strategies(self, client):
        resp = client.get("/api/v1/strategies/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 11
        assert len(data["strategies"]) == data["total"]
        assert "families" in data

    def test_strategy_has_required_fields(self, client):
        resp = client.get("/api/v1/strategies/")
        data = resp.json()
        for strat in data["strategies"]:
            assert "name" in strat
            assert "family" in strat
            assert "description" in strat
            assert "default_params" in strat


class TestFamilyEndpoint:
    def test_trend_following(self, client):
        resp = client.get("/api/v1/strategies/families/trend_following")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert data["families"] == ["trend_following"]

    def test_momentum(self, client):
        resp = client.get("/api/v1/strategies/families/momentum")
        assert resp.status_code == 200
        assert resp.json()["total"] == 3

    def test_mean_reversion(self, client):
        resp = client.get("/api/v1/strategies/families/mean_reversion")
        assert resp.status_code == 200
        assert resp.json()["total"] == 3

    def test_value(self, client):
        resp = client.get("/api/v1/strategies/families/value")
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

    def test_unknown_family_404(self, client):
        resp = client.get("/api/v1/strategies/families/nonexistent")
        assert resp.status_code == 404


class TestStrategyDetail:
    def test_get_sma_crossover(self, client):
        resp = client.get("/api/v1/strategies/sma_crossover")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "sma_crossover"
        assert data["family"] == "trend_following"
        assert "fast_period" in data["default_params"]
        assert "slow_period" in data["default_params"]

    def test_get_unknown_404(self, client):
        resp = client.get("/api/v1/strategies/nonexistent")
        assert resp.status_code == 404


class TestStrategyScan:
    @patch("src.api.routes.strategies.SignalGenerator")
    @patch("src.api.routes.strategies._get_polygon")
    @patch("src.api.routes.strategies.get_db")
    def test_scan_uses_cached_market_data_without_polygon(
        self,
        mock_get_db,
        mock_get_polygon,
        mock_signal_generator_cls,
        client,
    ):
        instrument_query = MagicMock()
        instrument_query.select.return_value = instrument_query
        instrument_query.eq.return_value = instrument_query
        instrument_query.maybe_single.return_value = instrument_query
        instrument_query.execute.return_value = SimpleNamespace(data={"id": "inst-aapl"})

        now = datetime.now(UTC)
        rows = [
            {
                "timestamp": (now - timedelta(days=30 - i)).isoformat(),
                "open": 100 + i,
                "high": 101 + i,
                "low": 99 + i,
                "close": 100.5 + i,
                "volume": 1_000 + i,
            }
            for i in range(30)
        ]
        market_data_query = MagicMock()
        market_data_query.select.return_value = market_data_query
        market_data_query.eq.return_value = market_data_query
        market_data_query.gte.return_value = market_data_query
        market_data_query.lte.return_value = market_data_query
        market_data_query.order.return_value = market_data_query
        market_data_query.execute.return_value = SimpleNamespace(data=rows)

        mock_db = MagicMock()
        mock_db.table.side_effect = lambda name: (
            instrument_query if name == "instruments" else market_data_query
        )
        mock_get_db.return_value = mock_db

        mock_batch = MagicMock(total_signals=0, tickers_scanned=1, strategies_run=4, errors=[])
        mock_batch.top_signals.return_value = []
        mock_generator = MagicMock()
        mock_generator.scan.return_value = mock_batch
        mock_signal_generator_cls.return_value = mock_generator

        response = client.post("/api/v1/strategies/scan", json={"tickers": ["AAPL"], "days": 30})

        assert response.status_code == 200
        assert response.json()["tickers_scanned"] == 1
        mock_get_polygon.assert_not_called()

    @patch("src.api.routes.strategies.SignalGenerator")
    @patch("src.api.routes.strategies._get_polygon")
    @patch("src.api.routes.strategies.get_db")
    def test_scan_falls_back_to_polygon_when_cache_is_empty(
        self,
        mock_get_db,
        mock_get_polygon,
        mock_signal_generator_cls,
        client,
    ):
        instrument_query = MagicMock()
        instrument_query.select.return_value = instrument_query
        instrument_query.eq.return_value = instrument_query
        instrument_query.maybe_single.return_value = instrument_query
        instrument_query.execute.return_value = SimpleNamespace(data={"id": "inst-aapl"})

        market_data_query = MagicMock()
        market_data_query.select.return_value = market_data_query
        market_data_query.eq.return_value = market_data_query
        market_data_query.gte.return_value = market_data_query
        market_data_query.lte.return_value = market_data_query
        market_data_query.order.return_value = market_data_query
        market_data_query.execute.return_value = SimpleNamespace(data=[])

        mock_db = MagicMock()
        mock_db.table.side_effect = lambda name: (
            instrument_query if name == "instruments" else market_data_query
        )
        mock_get_db.return_value = mock_db

        now = datetime.now(UTC)
        mock_polygon = MagicMock()
        mock_polygon.get_bars = AsyncMock(
            return_value=[
                PolygonBar(
                    timestamp=now - timedelta(days=30 - i),
                    open=100 + i,
                    high=101 + i,
                    low=99 + i,
                    close=100.5 + i,
                    volume=1_000 + i,
                )
                for i in range(30)
            ]
        )
        mock_polygon.close = AsyncMock()
        mock_get_polygon.return_value = mock_polygon

        mock_batch = MagicMock(total_signals=0, tickers_scanned=1, strategies_run=4, errors=[])
        mock_batch.top_signals.return_value = []
        mock_generator = MagicMock()
        mock_generator.scan.return_value = mock_batch
        mock_signal_generator_cls.return_value = mock_generator

        response = client.post("/api/v1/strategies/scan", json={"tickers": ["AAPL"], "days": 30})

        assert response.status_code == 200
        assert response.json()["tickers_scanned"] == 1
        mock_get_polygon.assert_called_once()

    @patch("src.api.routes.strategies._get_polygon")
    @patch("src.api.routes.strategies.get_db")
    def test_scan_returns_errors_instead_of_failing_when_polygon_rate_limits(
        self,
        mock_get_db,
        mock_get_polygon,
        client,
    ):
        instrument_query = MagicMock()
        instrument_query.select.return_value = instrument_query
        instrument_query.eq.return_value = instrument_query
        instrument_query.maybe_single.return_value = instrument_query
        instrument_query.execute.return_value = SimpleNamespace(data={"id": "inst-aapl"})

        market_data_query = MagicMock()
        market_data_query.select.return_value = market_data_query
        market_data_query.eq.return_value = market_data_query
        market_data_query.gte.return_value = market_data_query
        market_data_query.lte.return_value = market_data_query
        market_data_query.order.return_value = market_data_query
        market_data_query.execute.return_value = SimpleNamespace(data=[])

        mock_db = MagicMock()
        mock_db.table.side_effect = lambda name: (
            instrument_query if name == "instruments" else market_data_query
        )
        mock_get_db.return_value = mock_db

        request = httpx.Request("GET", "https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day")
        rate_limit_error = httpx.HTTPStatusError(
            "429",
            request=request,
            response=httpx.Response(429, request=request),
        )

        mock_polygon = MagicMock()
        mock_polygon.get_bars = AsyncMock(side_effect=rate_limit_error)
        mock_polygon.close = AsyncMock()
        mock_get_polygon.return_value = mock_polygon

        response = client.post("/api/v1/strategies/scan", json={"tickers": ["AAPL"], "days": 30})

        assert response.status_code == 200
        body = response.json()
        assert body["signals"] == []
        assert body["tickers_scanned"] == 0
        assert body["strategies_run"] == 0
        assert len(body["errors"]) == 1
