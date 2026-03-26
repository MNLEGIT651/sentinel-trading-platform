"""Tests for Pydantic request validators in api/validators.py."""

import pytest
from pydantic import ValidationError

from src.api.validators import (
    GetBarsRequest,
    GetQuotesRequest,
    IngestRequestValidated,
    PaginationParams,
    ScanRequestValidated,
)

# ---------------------------------------------------------------------------
# GetBarsRequest
# ---------------------------------------------------------------------------


class TestGetBarsRequest:
    def test_valid_defaults(self):
        req = GetBarsRequest(ticker="AAPL")
        assert req.ticker == "AAPL"
        assert req.timeframe == "1d"
        assert req.days == 90

    def test_valid_custom_values(self):
        req = GetBarsRequest(ticker="MSFT", timeframe="1h", days=30)
        assert req.ticker == "MSFT"
        assert req.timeframe == "1h"
        assert req.days == 30

    def test_all_valid_timeframes(self):
        for tf in ("1m", "5m", "15m", "1h", "1d"):
            req = GetBarsRequest(ticker="SPY", timeframe=tf)
            assert req.timeframe == tf

    def test_invalid_timeframe_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="SPY", timeframe="2d")

    def test_days_minimum_boundary(self):
        req = GetBarsRequest(ticker="AAPL", days=1)
        assert req.days == 1

    def test_days_maximum_boundary(self):
        req = GetBarsRequest(ticker="AAPL", days=365)
        assert req.days == 365

    def test_days_below_minimum_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL", days=0)

    def test_days_above_maximum_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL", days=366)

    def test_ticker_lowercase_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="aapl")

    def test_ticker_with_special_characters_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="A!PL")

    def test_empty_ticker_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="")

    def test_ticker_too_long_rejected(self):
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="TOOLONGTICKER")

    def test_ticker_with_numbers_valid(self):
        req = GetBarsRequest(ticker="BRK")
        assert req.ticker == "BRK"


# ---------------------------------------------------------------------------
# GetQuotesRequest
# ---------------------------------------------------------------------------


class TestGetQuotesRequest:
    def test_valid_defaults(self):
        req = GetQuotesRequest()
        # Default should parse without error
        assert req.tickers is not None
        assert len(req.tickers) > 0

    def test_valid_custom_tickers(self):
        req = GetQuotesRequest(tickers="AAPL,MSFT,GOOGL")
        assert "AAPL" in req.tickers
        assert "MSFT" in req.tickers

    def test_single_ticker_valid(self):
        req = GetQuotesRequest(tickers="SPY")
        assert req.tickers == "SPY"

    def test_empty_tickers_rejected(self):
        with pytest.raises(ValidationError):
            GetQuotesRequest(tickers="")

    def test_more_than_100_tickers_rejected(self):
        tickers = ",".join([f"T{i:03d}" for i in range(101)])
        with pytest.raises(ValidationError):
            GetQuotesRequest(tickers=tickers)

    def test_exactly_100_tickers_accepted(self):
        tickers = ",".join([f"T{i:03d}" for i in range(100)])
        req = GetQuotesRequest(tickers=tickers)
        assert req.tickers is not None

    def test_invalid_ticker_in_list_rejected(self):
        with pytest.raises(ValidationError):
            GetQuotesRequest(tickers="AAPL,TOOLONGTICKER,MSFT")


# ---------------------------------------------------------------------------
# IngestRequestValidated
# ---------------------------------------------------------------------------


class TestIngestRequestValidated:
    def test_valid_request(self):
        req = IngestRequestValidated(tickers=["AAPL", "MSFT"], timeframe="1d")
        assert req.tickers == ["AAPL", "MSFT"]
        assert req.timeframe == "1d"

    def test_tickers_uppercased_automatically(self):
        req = IngestRequestValidated(tickers=["aapl", "msft"])
        assert req.tickers == ["AAPL", "MSFT"]

    def test_whitespace_stripped_from_tickers(self):
        req = IngestRequestValidated(tickers=[" AAPL ", " MSFT "])
        assert "AAPL" in req.tickers

    def test_empty_tickers_list_rejected(self):
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=[])

    def test_too_many_tickers_rejected(self):
        tickers = [f"T{i:03d}" for i in range(51)]
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=tickers)

    def test_invalid_ticker_format_rejected(self):
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=["AAPL", "!INVALID"])

    def test_all_valid_timeframes(self):
        for tf in ("1m", "5m", "15m", "1h", "1d"):
            req = IngestRequestValidated(tickers=["AAPL"], timeframe=tf)
            assert req.timeframe == tf

    def test_default_timeframe(self):
        req = IngestRequestValidated(tickers=["AAPL"])
        assert req.timeframe == "1d"

    def test_invalid_timeframe_rejected(self):
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=["AAPL"], timeframe="4h")


# ---------------------------------------------------------------------------
# ScanRequestValidated
# ---------------------------------------------------------------------------


class TestScanRequestValidated:
    def test_valid_defaults(self):
        req = ScanRequestValidated(tickers=["AAPL", "MSFT"])
        assert req.tickers == ["AAPL", "MSFT"]
        assert req.days == 90
        assert req.min_strength == pytest.approx(0.3)
        assert req.use_composite is False

    def test_custom_values(self):
        req = ScanRequestValidated(
            tickers=["SPY"],
            days=180,
            min_strength=0.7,
            use_composite=True,
        )
        assert req.days == 180
        assert req.min_strength == pytest.approx(0.7)
        assert req.use_composite is True

    def test_days_minimum_boundary(self):
        req = ScanRequestValidated(tickers=["AAPL"], days=30)
        assert req.days == 30

    def test_days_maximum_boundary(self):
        req = ScanRequestValidated(tickers=["AAPL"], days=365)
        assert req.days == 365

    def test_days_below_minimum_rejected(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL"], days=29)

    def test_days_above_maximum_rejected(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL"], days=366)

    def test_min_strength_boundary_values(self):
        req_min = ScanRequestValidated(tickers=["AAPL"], min_strength=0.0)
        req_max = ScanRequestValidated(tickers=["AAPL"], min_strength=1.0)
        assert req_min.min_strength == pytest.approx(0.0)
        assert req_max.min_strength == pytest.approx(1.0)

    def test_min_strength_out_of_range_rejected(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL"], min_strength=1.1)

        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL"], min_strength=-0.1)

    def test_empty_tickers_rejected(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=[])

    def test_more_than_20_tickers_rejected(self):
        tickers = [f"T{i:02d}" for i in range(21)]
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=tickers)

    def test_invalid_ticker_rejected(self):
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL", "invalid-ticker!"])

    def test_tickers_uppercased(self):
        req = ScanRequestValidated(tickers=["aapl", "msft"])
        assert "AAPL" in req.tickers
        assert "MSFT" in req.tickers


# ---------------------------------------------------------------------------
# PaginationParams
# ---------------------------------------------------------------------------


class TestPaginationParams:
    def test_valid_defaults(self):
        params = PaginationParams()
        assert params.offset == 0
        assert params.limit == 100

    def test_custom_values(self):
        params = PaginationParams(offset=50, limit=25)
        assert params.offset == 50
        assert params.limit == 25

    def test_offset_minimum_boundary(self):
        params = PaginationParams(offset=0)
        assert params.offset == 0

    def test_negative_offset_rejected(self):
        with pytest.raises(ValidationError):
            PaginationParams(offset=-1)

    def test_limit_minimum_boundary(self):
        params = PaginationParams(limit=1)
        assert params.limit == 1

    def test_limit_maximum_boundary(self):
        params = PaginationParams(limit=1000)
        assert params.limit == 1000

    def test_limit_below_minimum_rejected(self):
        with pytest.raises(ValidationError):
            PaginationParams(limit=0)

    def test_limit_above_maximum_rejected(self):
        with pytest.raises(ValidationError):
            PaginationParams(limit=1001)
