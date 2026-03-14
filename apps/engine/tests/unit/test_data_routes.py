"""Tests for the data ingestion API routes."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from src.api.main import app
from src.data.ingestion import DataIngestionService, IngestionResult


class TestIngestEndpoint:
    def setup_method(self):
        self.client = TestClient(app)

    @patch("src.api.routes.data.get_ingestion_service")
    def test_ingest_success(self, mock_get_service):
        mock_service = AsyncMock(spec=DataIngestionService)
        mock_service.ingest_batch.return_value = IngestionResult(ingested=10, errors=[])
        mock_get_service.return_value = mock_service

        response = self.client.post(
            "/api/v1/data/ingest",
            json={"tickers": ["AAPL", "MSFT"], "timeframe": "1d"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ingested"] == 10
        assert data["errors"] == []

    @patch("src.api.routes.data.get_ingestion_service")
    def test_ingest_with_errors(self, mock_get_service):
        mock_service = AsyncMock(spec=DataIngestionService)
        mock_service.ingest_batch.return_value = IngestionResult(
            ingested=5, errors=["Failed to ingest GOOG: timeout"]
        )
        mock_get_service.return_value = mock_service

        response = self.client.post(
            "/api/v1/data/ingest",
            json={"tickers": ["AAPL", "GOOG"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ingested"] == 5
        assert len(data["errors"]) == 1

    def test_ingest_empty_tickers_rejected(self):
        response = self.client.post(
            "/api/v1/data/ingest",
            json={"tickers": []},
        )
        assert response.status_code == 422
