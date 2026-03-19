"""Tests for the data ingestion service."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

from src.data.ingestion import DataIngestionService
from src.data.polygon_client import PolygonBar


def _make_bar(close: float = 150.0) -> PolygonBar:
    return PolygonBar(
        timestamp=datetime(2024, 1, 1, tzinfo=UTC),
        open=149.0,
        high=151.0,
        low=148.0,
        close=close,
        volume=1000,
        vwap=150.0,
    )


def _mock_db(instrument_id: str | None = "inst-123"):
    """Create a mock DB that behaves like SupabaseDB."""
    db = MagicMock()

    # instruments table mock
    instruments_chain = MagicMock()
    instruments_chain.select.return_value = instruments_chain
    instruments_chain.eq.return_value = instruments_chain
    if instrument_id:
        instruments_chain.execute.return_value = MagicMock(data=[{"id": instrument_id}])
    else:
        instruments_chain.execute.return_value = MagicMock(data=[])

    # market_data table mock
    market_data_chain = MagicMock()
    market_data_chain.upsert.return_value = market_data_chain
    market_data_chain.execute.return_value = MagicMock(data=[])

    def table_dispatch(name: str):
        if name == "instruments":
            return instruments_chain
        if name == "market_data":
            return market_data_chain
        return MagicMock()

    db.table.side_effect = table_dispatch
    return db, instruments_chain, market_data_chain


class TestIngestTicker:
    async def test_fetches_and_stores(self):
        polygon = MagicMock()
        polygon.get_bars = AsyncMock(return_value=[_make_bar(150.0), _make_bar(155.0)])
        db, _, market_data_chain = _mock_db("inst-abc")

        service = DataIngestionService(polygon=polygon, db=db)
        result = await service.ingest_ticker("AAPL", timeframe="1d")

        assert result.ingested == 2
        assert result.errors == []
        polygon.get_bars.assert_called_once()
        market_data_chain.upsert.assert_called_once()

    async def test_instrument_not_found(self):
        polygon = MagicMock()
        polygon.get_bars = AsyncMock()
        db, _, _ = _mock_db(instrument_id=None)

        service = DataIngestionService(polygon=polygon, db=db)
        result = await service.ingest_ticker("UNKNOWN")

        assert result.ingested == 0
        assert len(result.errors) == 1
        assert "Instrument not found: UNKNOWN" in result.errors[0]
        polygon.get_bars.assert_not_called()

    async def test_handles_empty_bars(self):
        polygon = MagicMock()
        polygon.get_bars = AsyncMock(return_value=[])
        db, _, market_data_chain = _mock_db("inst-abc")

        service = DataIngestionService(polygon=polygon, db=db)
        result = await service.ingest_ticker("AAPL")

        assert result.ingested == 0
        assert result.errors == []
        market_data_chain.upsert.assert_not_called()

    async def test_handles_api_error(self):
        polygon = MagicMock()
        polygon.get_bars = AsyncMock(side_effect=Exception("API timeout"))
        db, _, _ = _mock_db("inst-abc")

        service = DataIngestionService(polygon=polygon, db=db)
        result = await service.ingest_ticker("AAPL")

        assert result.ingested == 0
        assert len(result.errors) == 1
        assert "Failed to ingest AAPL" in result.errors[0]


class TestIngestBatch:
    async def test_processes_multiple_tickers(self):
        polygon = MagicMock()
        polygon.get_bars = AsyncMock(return_value=[_make_bar()])
        db, _, _ = _mock_db("inst-abc")

        service = DataIngestionService(polygon=polygon, db=db)
        result = await service.ingest_batch(["AAPL", "MSFT", "GOOG"])

        assert result.ingested == 3
        assert result.errors == []
        assert polygon.get_bars.call_count == 3
