"""Tests for the data ingestion API routes."""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from src.api.main import app
from src.data.ingestion import IngestionResult


class TestIngestEndpoint:
    def setup_method(self):
        self.client = TestClient(app)

    @patch("src.api.routes.data.get_db")
    @patch("src.data.ingestion.DataIngestionService")
    def test_ingest_success(self, mock_service_cls, mock_get_db):
        mock_get_db.return_value = MagicMock()
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
    @patch("src.data.ingestion.DataIngestionService")
    def test_ingest_with_errors(self, mock_service_cls, mock_get_db):
        mock_get_db.return_value = MagicMock()
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
