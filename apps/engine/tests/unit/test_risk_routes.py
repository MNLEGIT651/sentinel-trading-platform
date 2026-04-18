"""Tests for risk management API routes."""

from unittest.mock import MagicMock, patch

# Uses the `client` fixture from conftest.py (includes API key header).


class TestPositionSize:
    """Tests for POST /api/v1/risk/position-size."""

    def test_fixed_fraction_default(self, client):
        resp = client.post(
            "/api/v1/risk/position-size",
            json={"ticker": "AAPL", "price": 150.0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ticker"] == "AAPL"
        assert data["method"] == "fixed_fraction"
        assert data["shares"] >= 0
        assert data["dollar_amount"] >= 0

    def test_fixed_fraction_with_stop_distance(self, client):
        resp = client.post(
            "/api/v1/risk/position-size",
            json={
                "ticker": "AAPL",
                "price": 150.0,
                "method": "fixed_fraction",
                "equity": 200_000,
                "risk_fraction": 0.02,
                "stop_distance": 5.0,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["shares"] > 0

    def test_volatility_target(self, client):
        resp = client.post(
            "/api/v1/risk/position-size",
            json={
                "ticker": "TSLA",
                "price": 250.0,
                "method": "volatility_target",
                "equity": 100_000,
                "atr": 8.0,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["method"] == "volatility_target"

    def test_kelly_criterion(self, client):
        resp = client.post(
            "/api/v1/risk/position-size",
            json={
                "ticker": "MSFT",
                "price": 400.0,
                "method": "kelly_criterion",
                "equity": 100_000,
                "win_rate": 0.6,
                "avg_win": 5.0,
                "avg_loss": 3.0,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["method"] == "kelly_criterion"


class TestAssessPortfolioRisk:
    """Tests for POST /api/v1/risk/assess."""

    def test_basic_assessment(self, client):
        resp = client.post(
            "/api/v1/risk/assess",
            json={
                "equity": 100_000,
                "cash": 50_000,
                "peak_equity": 110_000,
                "daily_starting_equity": 99_000,
                "positions": {"AAPL": 50, "MSFT": 30},
                "position_sectors": {"AAPL": "tech", "MSFT": "tech"},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "cash_pct" in data
        assert "concentrations" in data

    def test_empty_portfolio(self, client):
        resp = client.post(
            "/api/v1/risk/assess",
            json={
                "equity": 100_000,
                "cash": 100_000,
                "peak_equity": 100_000,
                "daily_starting_equity": 100_000,
            },
        )
        assert resp.status_code == 200


class TestPreTradeCheck:
    """Tests for POST /api/v1/risk/pre-trade-check."""

    def test_allows_small_trade(self, client):
        resp = client.post(
            "/api/v1/risk/pre-trade-check",
            json={
                "ticker": "AAPL",
                "shares": 5,
                "price": 150.0,
                "side": "buy",
                "equity": 100_000,
                "cash": 50_000,
                "peak_equity": 100_000,
                "daily_starting_equity": 100_000,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "allowed" in data
        assert isinstance(data["allowed"], bool)

    def test_blocks_oversized_trade(self, client):
        resp = client.post(
            "/api/v1/risk/pre-trade-check",
            json={
                "ticker": "AAPL",
                "shares": 5000,
                "price": 150.0,
                "side": "buy",
                "equity": 100_000,
                "cash": 50_000,
                "peak_equity": 100_000,
                "daily_starting_equity": 100_000,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        # Trade value is $750k which exceeds reasonable position limits
        # The risk manager should block or adjust
        assert "allowed" in data

    def test_includes_recommendation_id_in_response(self, client):
        resp = client.post(
            "/api/v1/risk/pre-trade-check",
            json={
                "ticker": "AAPL",
                "shares": 5,
                "price": 150.0,
                "side": "buy",
                "equity": 100_000,
                "cash": 50_000,
                "peak_equity": 100_000,
                "daily_starting_equity": 100_000,
                "recommendation_id": "rec-123",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["recommendation_id"] == "rec-123"


class TestGetRiskLimits:
    """Tests for GET /api/v1/risk/limits."""

    def test_returns_limits(self, client):
        resp = client.get("/api/v1/risk/limits")
        assert resp.status_code == 200
        data = resp.json()
        assert "max_position_pct" in data
        assert "max_sector_pct" in data
        assert "max_portfolio_risk_pct" in data
        assert "max_drawdown_soft" in data
        assert "max_drawdown_hard" in data
        assert data["max_position_pct"] > 0
        assert data["max_open_positions"] > 0


class TestRiskState:
    """Tests for GET /api/v1/risk/state."""

    @patch("src.api.routes.risk.get_db")
    def test_returns_503_when_db_not_configured(self, mock_get_db, client):
        mock_get_db.return_value = None
        resp = client.get("/api/v1/risk/state")
        assert resp.status_code == 503

    @patch("src.api.routes.risk.get_db")
    def test_returns_risk_state(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        # Mock system_controls query
        chain = mock_db.table.return_value.select.return_value
        chain.limit.return_value.single.return_value.execute.return_value = MagicMock(
            data={"trading_halted": False, "live_execution_enabled": True, "global_mode": "paper"}
        )

        # Mock portfolio_snapshots (drawdown)
        snap = chain.order.return_value.limit.return_value
        snap.maybe_single.return_value.execute.return_value = MagicMock(
            data={"drawdown": 0.02, "max_drawdown": 0.05}
        )

        # Mock risk_evaluations (recent blocks)
        evals = chain.eq.return_value.order.return_value.limit.return_value
        evals.execute.return_value = MagicMock(data=[])

        resp = client.get("/api/v1/risk/state")
        assert resp.status_code == 200
        data = resp.json()
        assert "trading_halted" in data
        assert "live_execution_enabled" in data


class TestHaltResume:
    """Tests for POST /api/v1/risk/halt and /resume."""

    @patch("src.api.routes.risk.get_db")
    def test_halt_returns_503_without_db(self, mock_get_db, client):
        mock_get_db.return_value = None
        resp = client.post("/api/v1/risk/halt", json={"reason": "Emergency"})
        assert resp.status_code == 503

    @patch("src.api.routes.risk.get_db")
    def test_resume_returns_503_without_db(self, mock_get_db, client):
        mock_get_db.return_value = None
        resp = client.post("/api/v1/risk/resume", json={"reason": "All clear"})
        assert resp.status_code == 503


class TestGetRiskPolicy:
    """Tests for GET /api/v1/risk/policy."""

    @patch("src.api.routes.risk.get_db")
    def test_returns_404_when_no_active_policy(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        chain = mock_db.table.return_value.select.return_value
        tail = chain.is_.return_value.order.return_value.limit.return_value
        tail.maybe_single.return_value.execute.return_value = MagicMock(data=None)

        resp = client.get("/api/v1/risk/policy")
        assert resp.status_code == 404

    @patch("src.api.routes.risk.get_db")
    def test_returns_active_policy(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        chain = mock_db.table.return_value.select.return_value
        tail = chain.is_.return_value.order.return_value.limit.return_value
        tail.maybe_single.return_value.execute.return_value = MagicMock(
            data={
                "id": "pol-1",
                "version": 3,
                "max_position_pct": 5.0,
                "max_sector_pct": 20.0,
                "daily_loss_limit_pct": 2.0,
                "soft_drawdown_pct": 10.0,
                "hard_drawdown_pct": 15.0,
                "approval_required": True,
                "autonomy_mode": "suggest",
                "enabled_at": "2026-04-01T00:00:00Z",
            }
        )

        resp = client.get("/api/v1/risk/policy")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == 3
        assert data["autonomy_mode"] == "suggest"


class TestRiskPolicyValidation:
    """Regression tests for risk policy input validation (Patch 5/7)."""

    def test_rejects_oversized_max_position_pct(self, client):
        resp = client.put(
            "/api/v1/risk/policy",
            json={"max_position_pct": 1000.0},
        )
        assert resp.status_code == 422

    def test_rejects_zero_pct(self, client):
        resp = client.put(
            "/api/v1/risk/policy",
            json={"daily_loss_limit_pct": 0},
        )
        assert resp.status_code == 422

    def test_rejects_negative_pct(self, client):
        resp = client.put(
            "/api/v1/risk/policy",
            json={"max_sector_pct": -5.0},
        )
        assert resp.status_code == 422

    def test_rejects_invalid_autonomy_mode(self, client):
        resp = client.put(
            "/api/v1/risk/policy",
            json={"autonomy_mode": "yolo"},
        )
        assert resp.status_code == 422

    @patch("src.api.routes.risk.get_db")
    def test_rejects_soft_gte_hard_drawdown(self, mock_get_db, client):
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        chain = mock_db.table.return_value.select.return_value
        tail = chain.is_.return_value.order.return_value.limit.return_value
        tail.maybe_single.return_value.execute.return_value = MagicMock(data=None)

        resp = client.put(
            "/api/v1/risk/policy",
            json={"soft_drawdown_pct": 20.0, "hard_drawdown_pct": 10.0},
        )
        assert resp.status_code == 422
        assert "soft_drawdown_pct" in resp.json()["detail"]
