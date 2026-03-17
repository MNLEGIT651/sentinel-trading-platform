"""Tests that rate limiting is enforced on expensive endpoints."""

from fastapi.testclient import TestClient

from src.api.main import app

# raise_server_exceptions=False so that 5xx errors return HTTP responses
# rather than propagating exceptions through the test client.
client = TestClient(app, raise_server_exceptions=False)


def test_ingest_rate_limit_enforced():
    """POST /api/v1/data/ingest should return 429 after exceeding limit."""
    responses = [client.post("/api/v1/data/ingest", json={"tickers": ["AAPL"]}) for _ in range(6)]
    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, f"Expected 429 but got: {status_codes}"


def test_scan_signals_rate_limit_enforced():
    """POST /api/v1/strategies/scan should return 429 after exceeding limit."""
    payload = {"tickers": ["AAPL"], "days": 30}
    responses = [client.post("/api/v1/strategies/scan", json=payload) for _ in range(6)]
    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, f"Expected 429 but got: {status_codes}"
