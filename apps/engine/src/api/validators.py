"""Enhanced request models with comprehensive validation."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class GetBarsRequest(BaseModel):
    """Validated request for historical bars endpoint."""

    ticker: str = Field(
        ...,
        min_length=1,
        max_length=10,
        pattern="^[A-Z0-9]{1,10}$",
        description="Stock ticker symbol (uppercase, alphanumeric only)",
    )
    timeframe: Literal["1m", "5m", "15m", "1h", "1d"] = Field(
        default="1d",
        description="Candlestick timeframe",
    )
    days: int = Field(
        default=90,
        ge=1,
        le=365,
        description="Historical days to retrieve (1-365)",
    )

    @field_validator("ticker")
    @classmethod
    def validate_ticker_format(cls, v: str) -> str:
        """Ensure ticker is uppercase and valid."""
        if not v.isupper():
            raise ValueError("ticker must be uppercase")
        if not v.replace("-", "").replace(".", "").isalnum():
            raise ValueError("ticker must contain only alphanumeric characters, hyphens, or dots")
        return v


class GetQuotesRequest(BaseModel):
    """Validated request for multiple quotes."""

    tickers: str = Field(
        default="AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA,META,SPY",
        description="Comma-separated ticker symbols",
    )

    @field_validator("tickers")
    @classmethod
    def validate_tickers(cls, v: str) -> str:
        """Validate comma-separated tickers."""
        if not v:
            raise ValueError("tickers cannot be empty")
        ticker_list = [t.strip().upper() for t in v.split(",")]
        if len(ticker_list) > 100:
            raise ValueError("maximum 100 tickers per request")
        for ticker in ticker_list:
            if not (1 <= len(ticker) <= 10 and ticker.replace("-", "").isalnum()):
                raise ValueError(f"invalid ticker format: {ticker}")
        return v


class IngestRequestValidated(BaseModel):
    """Validated request for data ingestion."""

    tickers: list[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Tickers to ingest (1-50)",
    )
    timeframe: Literal["1m", "5m", "15m", "1h", "1d"] = Field(
        default="1d",
        description="Candlestick timeframe",
    )

    @field_validator("tickers")
    @classmethod
    def validate_tickers_list(cls, v: list[str]) -> list[str]:
        """Validate each ticker in list."""
        validated = []
        for ticker in v:
            ticker_upper = ticker.strip().upper()
            if not (1 <= len(ticker_upper) <= 10):
                raise ValueError(f"invalid ticker length: {ticker}")
            if not ticker_upper.replace("-", "").isalnum():
                raise ValueError(f"invalid ticker format: {ticker}")
            validated.append(ticker_upper)
        return validated


class ScanRequestValidated(BaseModel):
    """Validated request for strategy scan."""

    tickers: list[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Tickers to scan (1-20)",
    )
    days: int = Field(
        default=90,
        ge=30,
        le=365,
        description="Historical days (30-365)",
    )
    min_strength: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Minimum signal strength (0.0-1.0)",
    )
    use_composite: bool = Field(
        default=False,
        description="Use composite signal strategy",
    )

    @field_validator("tickers")
    @classmethod
    def validate_scan_tickers(cls, v: list[str]) -> list[str]:
        """Validate tickers for scan."""
        validated = []
        for ticker in v:
            ticker_upper = ticker.strip().upper()
            if not (1 <= len(ticker_upper) <= 10 and ticker_upper.isalnum()):
                raise ValueError(f"invalid ticker: {ticker}")
            validated.append(ticker_upper)
        return validated


class PaginationParams(BaseModel):
    """Standard pagination parameters."""

    offset: int = Field(
        default=0,
        ge=0,
        description="Number of items to skip",
    )
    limit: int = Field(
        default=100,
        ge=1,
        le=1000,
        description="Maximum items to return (1-1000)",
    )


class ListResponse[T](BaseModel):
    """Standard paginated list response."""

    data: list[T]
    offset: int
    limit: int
    total: int
    has_more: bool
