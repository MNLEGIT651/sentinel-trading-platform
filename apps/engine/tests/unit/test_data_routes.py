"""Tests for the data ingestion API routes."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from fastapi.testclient import TestClient

from src.api.main import _settings, app
from src.data.ingestion import IngestionResult


class TestIngestEndpoint:
    def setup_method(self):
        self.client = TestClient(app)
        self.client.headers["X-API-Key"] = _settings.engine_api_key

    @patch("src.api.routes.data.get_db")
    @patch("src.api.routes.data._get_polygon")
    @patch("src.data.ingestion.DataIngestionService")
    def test_ingest_success(self, mock_service_cls, mock_get_polygon, mock_get_db):
        mock_get_db.return_value = MagicMock()
        mock_get_polygon.return_value = MagicMock()
        mock_service = AsyncMock()
        mock_service.ingest_batch.return_value = IngestionResult(ingested=10, errors=[])
        mock_service_cls.return_value = mock_service

        response = self.client.post(
            "/api/v1/data/ingest",
            json={"tickers": ["AAPL", "MSFT"], "timeframe": "1d"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ingested"] == 10
        assert data["errors"] == []

    @patch("src.api.routes.data.get_db")
    @patch("src.api.routes.data._get_polygon")
    @patch("src.data.ingestion.DataIngestionService")
    def test_ingest_with_errors(self, mock_service_cls, mock_get_polygon, mock_get_db):
        mock_get_db.return_value = MagicMock()
        mock_get_polygon.return_value = MagicMock()
        mock_service = AsyncMock()
        mock_service.ingest_batch.return_value = IngestionResult(
            ingested=5, errors=["Failed to ingest GOOG: timeout"]
        )
        mock_service_cls.return_value = mock_service

        response = self.client.post(
            "/api/v1/data/ingest",
            json={"tickers": ["AAPL", "GOOG"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ingested"] == 5
        assert len(data["errors"]) == 1

    @patch("src.api.routes.data.get_db")
    def test_ingest_503_when_no_db(self, mock_get_db):
        mock_get_db.return_value = None

        response = self.client.post(
            "/api/v1/data/ingest",
            json={"tickers": ["AAPL", "MSFT"]},
        )

        assert response.status_code == 503

    def test_ingest_empty_tickers_rejected(self):
        response = self.client.post(
            "/api/v1/data/ingest",
            json={"tickers": []},
        )
        assert response.status_code == 422

    @patch("src.api.routes.data._get_polygon")
    def test_quotes_returns_partial_results_when_polygon_rate_limits(self, mock_get_polygon):
        first_bar = MagicMock()
        first_bar.open = 100.0
        first_bar.high = 101.0
        first_bar.low = 99.0
        first_bar.close = 100.5
        first_bar.volume = 1000
        first_bar.vwap = 100.2
        first_bar.timestamp = __import__("datetime").datetime(
            2024, 1, 15, tzinfo=__import__("datetime").timezone.utc
        )

        rate_limit_error = httpx.HTTPStatusError(
            "429",
            request=httpx.Request("GET", "https://api.polygon.io/v2/aggs/ticker/MSFT/prev"),
            response=httpx.Response(
                429,
                request=httpx.Request("GET", "https://api.polygon.io/v2/aggs/ticker/MSFT/prev"),
            ),
        )

        mock_polygon = MagicMock()
        mock_polygon.get_latest_price = AsyncMock(side_effect=[first_bar, rate_limit_error])
        mock_polygon.close = AsyncMock()
        mock_get_polygon.return_value = mock_polygon

        response = self.client.get("/api/v1/data/quotes?tickers=AAPL,MSFT")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["ticker"] == "AAPL"
