"""Tests for the live execution gate in order_service.py.

Validates that:
- PaperBroker always bypasses the gate
- AlpacaBroker with paper hostname bypasses the gate
- AlpacaBroker with live URL + DB unavailable → 503 (fail-closed)
- AlpacaBroker with live URL + flag disabled → 403
- AlpacaBroker with live URL + wrong mode → 403
- AlpacaBroker with live URL + both conditions true → allowed
- _is_paper_endpoint() handles edge cases safely (fail-closed)
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.execution.paper_broker import PaperBroker
from src.services.order_service import (
    _is_paper_endpoint,
    check_live_execution_gate,
    check_trading_halts,
)

# ---------------------------------------------------------------------------
# _is_paper_endpoint unit tests (safety-critical: must fail-closed)
# ---------------------------------------------------------------------------


class TestIsPaperEndpoint:
    """Direct unit tests for the hostname allowlist checker."""

    def test_known_paper_host(self):
        assert _is_paper_endpoint("https://paper-api.alpaca.markets") is True

    def test_known_paper_host_with_path(self):
        assert _is_paper_endpoint("https://paper-api.alpaca.markets/v2") is True

    def test_known_paper_host_uppercase(self):
        assert _is_paper_endpoint("https://PAPER-API.ALPACA.MARKETS") is True

    def test_live_host(self):
        assert _is_paper_endpoint("https://api.alpaca.markets") is False

    def test_live_host_with_paper_in_path(self):
        """Substring 'paper' in path must NOT bypass the gate."""
        assert _is_paper_endpoint("https://api.alpaca.markets/paper-compat") is False

    def test_live_host_with_paper_in_query(self):
        assert _is_paper_endpoint("https://api.alpaca.markets?mode=paper") is False

    def test_unknown_host(self):
        assert _is_paper_endpoint("https://evil-paper-api.alpaca.markets.attacker.com") is False

    def test_empty_string(self):
        assert _is_paper_endpoint("") is False

    def test_malformed_url(self):
        assert _is_paper_endpoint("not-a-url") is False

    def test_no_scheme(self):
        assert _is_paper_endpoint("paper-api.alpaca.markets") is False

    def test_ip_address(self):
        assert _is_paper_endpoint("https://192.168.1.1") is False

    def test_localhost(self):
        assert _is_paper_endpoint("http://localhost:8000") is False


# ---------------------------------------------------------------------------
# check_live_execution_gate integration tests
# ---------------------------------------------------------------------------


def _make_alpaca_broker(base_url: str) -> MagicMock:
    """Create a mock AlpacaBroker with a given base_url."""
    from src.execution.alpaca_broker import AlpacaBroker

    mock = MagicMock(spec=AlpacaBroker)
    type(mock).base_url = property(lambda self: base_url)
    return mock


def _mock_db_with_controls(data: dict | None = None) -> MagicMock:
    """Build a mock Supabase client that returns given system_controls data."""
    mock_db = MagicMock()
    chain = mock_db.table.return_value.select.return_value
    chain = chain.limit.return_value.single.return_value
    chain.execute.return_value = MagicMock(data=data)
    return mock_db


def _mock_db_with_error(exc: Exception) -> MagicMock:
    """Build a mock Supabase client that raises on execute."""
    mock_db = MagicMock()
    chain = mock_db.table.return_value.select.return_value
    chain = chain.limit.return_value.single.return_value
    chain.execute.side_effect = exc
    return mock_db


class TestLiveExecutionGate:
    """Tests for the fail-closed live execution gate."""

    @pytest.mark.asyncio
    async def test_paper_broker_bypasses_gate(self):
        """PaperBroker cannot move real capital — always allowed."""
        broker = PaperBroker()
        # Should not raise
        await check_live_execution_gate(broker)

    @pytest.mark.asyncio
    async def test_alpaca_paper_url_bypasses_gate(self):
        """AlpacaBroker with paper hostname — always allowed."""
        broker = _make_alpaca_broker("https://paper-api.alpaca.markets")
        await check_live_execution_gate(broker)

    @pytest.mark.asyncio
    @patch("src.services.order_service.get_db", return_value=None)
    async def test_live_url_no_db_returns_503(self, _mock_db):
        """Live URL + DB unavailable → 503 fail-closed."""
        broker = _make_alpaca_broker("https://api.alpaca.markets")
        with pytest.raises(HTTPException) as exc_info:
            await check_live_execution_gate(broker)
        assert exc_info.value.status_code == 503
        assert "database is not configured" in exc_info.value.detail

    @pytest.mark.asyncio
    @patch("src.services.order_service.get_db", return_value=None)
    async def test_hostile_urls_do_not_bypass_gate(self, _mock_db):
        """URLs with 'paper' outside the hostname must NOT bypass."""
        hostile_urls = [
            "https://api.alpaca.markets/paper-compat",
            "https://live.alpaca.markets/paper",
            "https://paper.evil.com",
            "https://api.alpaca.markets?env=paper",
        ]
        for url in hostile_urls:
            broker = _make_alpaca_broker(url)
            with pytest.raises(HTTPException) as exc_info:
                await check_live_execution_gate(broker)
            assert exc_info.value.status_code == 503, f"Expected 503 for {url}"

    @pytest.mark.asyncio
    async def test_live_url_flag_disabled_returns_403(self):
        """Live URL + live_execution_enabled=false → 403."""
        broker = _make_alpaca_broker("https://api.alpaca.markets")
        mock_db = _mock_db_with_controls({"live_execution_enabled": False, "global_mode": "live"})

        with patch("src.services.order_service.get_db", return_value=mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await check_live_execution_gate(broker)
            assert exc_info.value.status_code == 403


class TestTradingHalts:
    """Safety checks for system/experiment trading halts."""

    @pytest.mark.asyncio
    async def test_system_halt_query_error_fails_closed(self):
        mock_db = MagicMock()
        system_chain = (
            mock_db.table.return_value.select.return_value.limit.return_value.single.return_value
        )
        system_chain.execute.side_effect = RuntimeError("db down")

        with patch("src.services.order_service.get_db", return_value=mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await check_trading_halts(fail_closed=True)
            assert exc_info.value.status_code == 503
            assert "safety default" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_experiment_halt_query_error_fails_closed(self):
        mock_db = MagicMock()

        # system_controls check passes
        system_chain = (
            mock_db.table.return_value.select.return_value.limit.return_value.single.return_value
        )
        system_chain.execute.return_value = MagicMock(data={"trading_halted": False})

        # experiments check fails
        experiment_chain = (
            mock_db.table.return_value.select.return_value.eq.return_value.single.return_value
        )
        experiment_chain.execute.side_effect = RuntimeError("db timeout")

        with patch("src.services.order_service.get_db", return_value=mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await check_trading_halts(fail_closed=True, experiment_id="exp-123")
            assert exc_info.value.status_code == 503
            assert "safety default" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_live_url_wrong_mode_returns_403(self):
        """Live URL + global_mode='paper' → 403."""
        broker = _make_alpaca_broker("https://api.alpaca.markets")
        mock_db = _mock_db_with_controls({"live_execution_enabled": True, "global_mode": "paper"})

        with patch("src.services.order_service.get_db", return_value=mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await check_live_execution_gate(broker)
            assert exc_info.value.status_code == 403
            assert "paper" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_live_url_db_error_returns_503(self):
        """Live URL + DB query throws → 503 fail-closed."""
        broker = _make_alpaca_broker("https://api.alpaca.markets")
        mock_db = _mock_db_with_error(RuntimeError("connection lost"))

        with patch("src.services.order_service.get_db", return_value=mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await check_live_execution_gate(broker)
            assert exc_info.value.status_code == 503
            assert "safety default" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_live_url_fully_enabled_allows(self):
        """Live URL + live_execution_enabled=true + global_mode='live' → allowed."""
        broker = _make_alpaca_broker("https://api.alpaca.markets")
        mock_db = _mock_db_with_controls({"live_execution_enabled": True, "global_mode": "live"})

        with patch("src.services.order_service.get_db", return_value=mock_db):
            # Should not raise
            await check_live_execution_gate(broker)

    @pytest.mark.asyncio
    async def test_missing_controls_fields_fail_closed(self):
        """Empty system_controls row → defaults block live orders."""
        broker = _make_alpaca_broker("https://api.alpaca.markets")
        mock_db = _mock_db_with_controls({})

        with patch("src.services.order_service.get_db", return_value=mock_db):
            with pytest.raises(HTTPException) as exc_info:
                await check_live_execution_gate(broker)
            assert exc_info.value.status_code == 403
