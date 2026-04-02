"""Tests for signal API routes."""

from unittest.mock import MagicMock, patch

# Uses the `client` fixture from conftest.py (includes API key header).


class _FakeExecuteResult:
    """Mimics a PostgREST execute() result."""

    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count


def _make_signal_row(**overrides):
    return {
        "id": "sig-1",
        "instrument_id": "inst-1",
        "strategy_id": "strat-1",
        "direction": "long",
        "strength": 0.85,
        "confidence": 0.9,
        "metadata": {},
        "generated_at": "2026-04-01T12:00:00Z",
        "expires_at": "2026-04-02T12:00:00Z",
        "is_active": True,
        **overrides,
    }


class TestListSignals:
    """Tests for GET /api/v1/signals/."""

    @patch("src.api.routes.signals.get_db")
    def test_returns_signals(self, mock_get_db, client):
        rows = [_make_signal_row(), _make_signal_row(id="sig-2", direction="short")]
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        chain = mock_db.table.return_value.select.return_value
        chain.order.return_value.range.return_value.execute.return_value = _FakeExecuteResult(
            data=rows, count=2
        )

        resp = client.get("/api/v1/signals/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["signals"]) == 2
        assert data["signals"][0]["id"] == "sig-1"

    @patch("src.api.routes.signals.get_db")
    def test_filters_by_instrument_id(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        query_chain = mock_db.table.return_value.select.return_value
        query_chain.eq.return_value = query_chain
        query_chain.order.return_value.range.return_value.execute.return_value = _FakeExecuteResult(
            data=[_make_signal_row()], count=1
        )

        resp = client.get("/api/v1/signals/?instrument_id=inst-1")
        assert resp.status_code == 200
        query_chain.eq.assert_called()

    @patch("src.api.routes.signals.get_db")
    def test_filters_by_direction(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        query_chain = mock_db.table.return_value.select.return_value
        query_chain.eq.return_value = query_chain
        query_chain.order.return_value.range.return_value.execute.return_value = _FakeExecuteResult(
            data=[], count=0
        )

        resp = client.get("/api/v1/signals/?direction=short")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    @patch("src.api.routes.signals.get_db")
    def test_returns_503_when_db_not_configured(self, mock_get_db, client):
        mock_get_db.return_value = None
        resp = client.get("/api/v1/signals/")
        assert resp.status_code == 503

    @patch("src.api.routes.signals.get_db")
    def test_returns_empty_list(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        chain = mock_db.table.return_value.select.return_value
        chain.order.return_value.range.return_value.execute.return_value = _FakeExecuteResult(
            data=[], count=0
        )

        resp = client.get("/api/v1/signals/")
        assert resp.status_code == 200
        assert resp.json()["signals"] == []
        assert resp.json()["total"] == 0

    @patch("src.api.routes.signals.get_db")
    def test_handles_null_optional_fields(self, mock_get_db, client):
        row = _make_signal_row(
            instrument_id=None,
            strategy_id=None,
            strength=None,
            confidence=None,
            metadata=None,
        )
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        chain = mock_db.table.return_value.select.return_value
        chain.order.return_value.range.return_value.execute.return_value = _FakeExecuteResult(
            data=[row], count=1
        )

        resp = client.get("/api/v1/signals/")
        assert resp.status_code == 200
        signal = resp.json()["signals"][0]
        assert signal["instrument_id"] is None
        assert signal["metadata"] == {}


class TestGetSignal:
    """Tests for GET /api/v1/signals/{signal_id}."""

    @patch("src.api.routes.signals.get_db")
    def test_returns_single_signal(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        chain = mock_db.table.return_value.select.return_value.eq.return_value
        chain.maybe_single.return_value.execute.return_value = _FakeExecuteResult(
            data=_make_signal_row()
        )

        resp = client.get("/api/v1/signals/sig-1")
        assert resp.status_code == 200
        assert resp.json()["id"] == "sig-1"
        assert resp.json()["direction"] == "long"

    @patch("src.api.routes.signals.get_db")
    def test_returns_404_when_not_found(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        chain = mock_db.table.return_value.select.return_value.eq.return_value
        chain.maybe_single.return_value.execute.return_value = _FakeExecuteResult(data=None)

        resp = client.get("/api/v1/signals/nonexistent")
        assert resp.status_code == 404

    @patch("src.api.routes.signals.get_db")
    def test_returns_503_when_db_not_configured(self, mock_get_db, client):
        mock_get_db.return_value = None
        resp = client.get("/api/v1/signals/sig-1")
        assert resp.status_code == 503
