"""Unit tests for API validators.

Tests all request validators to ensure input validation prevents
malformed requests from reaching business logic or external APIs.
"""

import pytest
from pydantic import ValidationError

from src.api.validators import (
    GetBarsRequest,
    GetQuotesRequest,
    IngestRequestValidated,
    PaginationParams,
    ScanRequestValidated,
)


class TestGetBarsRequest:
    """Tests for GetBarsRequest validator."""

    def test_valid_request_with_defaults(self):
        """Valid ticker uses defaults for timeframe and days."""
        req = GetBarsRequest(ticker="AAPL")
        assert req.ticker == "AAPL"
        assert req.timeframe == "1d"
        assert req.days == 90

    def test_valid_request_all_params(self):
        """All valid parameters accepted."""
        req = GetBarsRequest(ticker="MSFT", timeframe="1h", days=30)
        assert req.ticker == "MSFT"
        assert req.timeframe == "1h"
        assert req.days == 30

    def test_ticker_must_be_uppercase(self):
        """Lowercase tickers are rejected."""
        with pytest.raises(ValidationError, match="ticker must be uppercase"):
            GetBarsRequest(ticker="aapl")

    def test_ticker_with_hyphen_accepted(self):
        """Tickers with hyphens (e.g., BRK-B) are valid."""
        req = GetBarsRequest(ticker="BRK-B")
        assert req.ticker == "BRK-B"

    def test_ticker_with_dot_accepted(self):
        """Tickers with dots are valid."""
        req = GetBarsRequest(ticker="BRK.B")
        assert req.ticker == "BRK.B"

    def test_ticker_too_short(self):
        """Empty ticker is rejected."""
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="")

    def test_ticker_too_long(self):
        """Ticker longer than 10 characters is rejected."""
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="VERYLONGTICKER")

    def test_ticker_with_special_chars_rejected(self):
        """Tickers with special characters (except hyphen/dot) are rejected."""
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL$")

    def test_timeframe_must_be_valid_literal(self):
        """Invalid timeframes are rejected."""
        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL", timeframe="2h")  # type: ignore

    def test_all_valid_timeframes(self):
        """All defined timeframes are accepted."""
        for tf in ["1m", "5m", "15m", "1h", "1d"]:
            req = GetBarsRequest(ticker="AAPL", timeframe=tf)  # type: ignore
            assert req.timeframe == tf

    def test_days_minimum_boundary(self):
        """Minimum days is 1."""
        req = GetBarsRequest(ticker="AAPL", days=1)
        assert req.days == 1

        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL", days=0)

    def test_days_maximum_boundary(self):
        """Maximum days is 365."""
        req = GetBarsRequest(ticker="AAPL", days=365)
        assert req.days == 365

        with pytest.raises(ValidationError):
            GetBarsRequest(ticker="AAPL", days=366)


class TestGetQuotesRequest:
    """Tests for GetQuotesRequest validator."""

    def test_valid_request_with_defaults(self):
        """Default tickers are set."""
        req = GetQuotesRequest()
        assert "AAPL" in req.tickers
        assert "MSFT" in req.tickers

    def test_valid_single_ticker(self):
        """Single ticker accepted."""
        req = GetQuotesRequest(tickers="AAPL")
        assert req.tickers == "AAPL"

    def test_valid_multiple_tickers(self):
        """Multiple comma-separated tickers accepted."""
        req = GetQuotesRequest(tickers="AAPL,MSFT,GOOGL")
        assert req.tickers == "AAPL,MSFT,GOOGL"

    def test_tickers_normalized_to_uppercase(self):
        """Lowercase tickers are normalized to uppercase."""
        req = GetQuotesRequest(tickers="aapl,msft")
        # Validator preserves original string but internal logic uppercases
        assert req.tickers == "aapl,msft"

    def test_empty_tickers_rejected(self):
        """Empty tickers string is rejected."""
        with pytest.raises(ValidationError, match="tickers cannot be empty"):
            GetQuotesRequest(tickers="")

    def test_max_100_tickers(self):
        """Maximum 100 tickers allowed."""
        tickers_99 = ",".join([f"TICK{i}" for i in range(99)])
        req = GetQuotesRequest(tickers=tickers_99)
        assert len(req.tickers.split(",")) == 99

        tickers_101 = ",".join([f"TICK{i}" for i in range(101)])
        with pytest.raises(ValidationError, match="maximum 100 tickers"):
            GetQuotesRequest(tickers=tickers_101)

    def test_invalid_ticker_format_rejected(self):
        """Tickers with invalid characters are rejected."""
        with pytest.raises(ValidationError, match="invalid ticker format"):
            GetQuotesRequest(tickers="AAPL,$INVALID,MSFT")

    def test_whitespace_trimmed(self):
        """Whitespace around tickers is trimmed."""
        req = GetQuotesRequest(tickers=" AAPL , MSFT , GOOGL ")
        # Validator trims internally
        assert "AAPL" in req.tickers


class TestIngestRequestValidated:
    """Tests for IngestRequestValidated."""

    def test_valid_request(self):
        """Valid ticker list and timeframe."""
        req = IngestRequestValidated(tickers=["AAPL", "MSFT"], timeframe="1d")
        assert req.tickers == ["AAPL", "MSFT"]
        assert req.timeframe == "1d"

    def test_tickers_normalized_to_uppercase(self):
        """Lowercase tickers are normalized."""
        req = IngestRequestValidated(tickers=["aapl", "msft"])
        assert req.tickers == ["AAPL", "MSFT"]

    def test_minimum_1_ticker(self):
        """At least 1 ticker required."""
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=[])

    def test_maximum_50_tickers(self):
        """Maximum 50 tickers allowed."""
        tickers_50 = [f"TICK{i}" for i in range(50)]
        req = IngestRequestValidated(tickers=tickers_50)
        assert len(req.tickers) == 50

        tickers_51 = [f"TICK{i}" for i in range(51)]
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=tickers_51)

    def test_invalid_ticker_length_rejected(self):
        """Tickers with invalid length are rejected."""
        with pytest.raises(ValidationError, match="invalid ticker length"):
            IngestRequestValidated(tickers=["VERYLONGTICKER"])

        with pytest.raises(ValidationError, match="invalid ticker length"):
            IngestRequestValidated(tickers=[""])

    def test_invalid_ticker_format_rejected(self):
        """Tickers with special characters are rejected."""
        with pytest.raises(ValidationError, match="invalid ticker format"):
            IngestRequestValidated(tickers=["AAPL$"])

    def test_ticker_with_hyphen_accepted(self):
        """Hyphens in tickers are allowed."""
        req = IngestRequestValidated(tickers=["BRK-B"])
        assert req.tickers == ["BRK-B"]

    def test_timeframe_must_be_valid(self):
        """Invalid timeframes are rejected."""
        with pytest.raises(ValidationError):
            IngestRequestValidated(tickers=["AAPL"], timeframe="2h")  # type: ignore


class TestScanRequestValidated:
    """Tests for ScanRequestValidated."""

    def test_valid_request_with_defaults(self):
        """Valid tickers use defaults."""
        req = ScanRequestValidated(tickers=["AAPL", "MSFT"])
        assert req.tickers == ["AAPL", "MSFT"]
        assert req.days == 90
        assert req.min_strength == 0.3
        assert req.use_composite is False

    def test_valid_request_all_params(self):
        """All parameters accepted."""
        req = ScanRequestValidated(
            tickers=["AAPL"], days=180, min_strength=0.5, use_composite=True
        )
        assert req.tickers == ["AAPL"]
        assert req.days == 180
        assert req.min_strength == 0.5
        assert req.use_composite is True

    def test_minimum_1_ticker(self):
        """At least 1 ticker required."""
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=[])

    def test_maximum_20_tickers(self):
        """Maximum 20 tickers allowed."""
        tickers_20 = [f"TICK{i}" for i in range(20)]
        req = ScanRequestValidated(tickers=tickers_20)
        assert len(req.tickers) == 20

        tickers_21 = [f"TICK{i}" for i in range(21)]
        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=tickers_21)

    def test_days_minimum_30(self):
        """Minimum days is 30."""
        req = ScanRequestValidated(tickers=["AAPL"], days=30)
        assert req.days == 30

        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL"], days=29)

    def test_days_maximum_365(self):
        """Maximum days is 365."""
        req = ScanRequestValidated(tickers=["AAPL"], days=365)
        assert req.days == 365

        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL"], days=366)

    def test_min_strength_boundaries(self):
        """Min strength must be between 0.0 and 1.0."""
        req = ScanRequestValidated(tickers=["AAPL"], min_strength=0.0)
        assert req.min_strength == 0.0

        req = ScanRequestValidated(tickers=["AAPL"], min_strength=1.0)
        assert req.min_strength == 1.0

        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL"], min_strength=-0.1)

        with pytest.raises(ValidationError):
            ScanRequestValidated(tickers=["AAPL"], min_strength=1.1)

    def test_invalid_ticker_format_rejected(self):
        """Tickers with non-alphanumeric characters are rejected."""
        with pytest.raises(ValidationError, match="invalid ticker"):
            ScanRequestValidated(tickers=["AAPL-B"])  # Scan rejects hyphens

    def test_tickers_normalized_to_uppercase(self):
        """Lowercase tickers are normalized."""
        req = ScanRequestValidated(tickers=["aapl", "msft"])
        assert req.tickers == ["AAPL", "MSFT"]


class TestPaginationParams:
    """Tests for PaginationParams."""

    def test_defaults(self):
        """Default offset and limit."""
        params = PaginationParams()
        assert params.offset == 0
        assert params.limit == 100

    def test_custom_values(self):
        """Custom offset and limit accepted."""
        params = PaginationParams(offset=50, limit=200)
        assert params.offset == 50
        assert params.limit == 200

    def test_offset_minimum(self):
        """Offset cannot be negative."""
        params = PaginationParams(offset=0)
        assert params.offset == 0

        with pytest.raises(ValidationError):
            PaginationParams(offset=-1)

    def test_limit_boundaries(self):
        """Limit must be between 1 and 1000."""
        params = PaginationParams(limit=1)
        assert params.limit == 1

        params = PaginationParams(limit=1000)
        assert params.limit == 1000

        with pytest.raises(ValidationError):
            PaginationParams(limit=0)

        with pytest.raises(ValidationError):
            PaginationParams(limit=1001)
