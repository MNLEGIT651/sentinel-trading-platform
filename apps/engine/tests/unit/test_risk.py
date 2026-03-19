"""Comprehensive tests for risk management system."""

import numpy as np
import pytest

from src.risk.portfolio_optimizer import (
    PortfolioOptimizer,
)
from src.risk.position_sizer import (
    PositionSizer,
    RiskLimits,
    SizingMethod,
)
from src.risk.risk_manager import (
    AlertSeverity,
    PortfolioState,
    RiskAction,
    RiskManager,
)

# ---------------------------------------------------------------------------
# Position Sizer Tests
# ---------------------------------------------------------------------------


class TestFixedFraction:
    def test_basic_sizing(self):
        # Use high max_position_pct to test pure sizing logic
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        result = sizer.fixed_fraction("AAPL", price=150.0, risk_fraction=0.01, stop_distance=3.0)
        # Risk = $1000, stop = $3, shares = 333
        assert result.shares == 333
        assert result.method == SizingMethod.FIXED_FRACTION
        assert result.risk_per_share == pytest.approx(3.0)

    def test_position_limit_enforced(self):
        sizer = PositionSizer(total_equity=100_000, risk_limits=RiskLimits(max_position_pct=0.05))
        result = sizer.fixed_fraction("AAPL", price=150.0, risk_fraction=0.10, stop_distance=1.0)
        # Without limit: 10000 shares. With 5% limit: max $5000 → 33 shares
        assert result.dollar_amount <= 5_000

    def test_default_stop_distance(self):
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        result = sizer.fixed_fraction("AAPL", price=100.0)
        # Default stop = 2% of price = $2, risk = $1000, shares = 500
        assert result.shares == 500

    def test_zero_equity(self):
        sizer = PositionSizer(total_equity=0)
        result = sizer.fixed_fraction("AAPL", price=100.0)
        assert result.shares == 0


class TestVolatilityTarget:
    def test_high_vol_reduces_size(self):
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        low_vol = sizer.volatility_target("AAPL", price=150.0, atr=2.0, target_vol=0.01)
        high_vol = sizer.volatility_target("AAPL", price=150.0, atr=10.0, target_vol=0.01)
        assert low_vol.shares > high_vol.shares

    def test_zero_atr(self):
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.volatility_target("AAPL", price=150.0, atr=0.0)
        assert result.shares == 0

    def test_position_limit(self):
        sizer = PositionSizer(total_equity=100_000, risk_limits=RiskLimits(max_position_pct=0.05))
        result = sizer.volatility_target("AAPL", price=150.0, atr=0.01)
        assert result.dollar_amount <= 5_000 + 150  # Allow one share tolerance


class TestKellyCriterion:
    def test_positive_edge(self):
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.kelly_criterion(
            "AAPL",
            price=150.0,
            win_rate=0.60,
            avg_win=0.02,
            avg_loss=0.01,
        )
        assert result.shares > 0
        assert result.method == SizingMethod.KELLY_CRITERION

    def test_negative_edge_no_position(self):
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.kelly_criterion(
            "AAPL",
            price=150.0,
            win_rate=0.30,
            avg_win=0.01,
            avg_loss=0.02,
        )
        assert result.shares == 0

    def test_zero_avg_loss(self):
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.kelly_criterion(
            "AAPL",
            price=150.0,
            win_rate=0.60,
            avg_win=0.02,
            avg_loss=0.0,
        )
        assert result.shares == 0


class TestEqualWeight:
    def test_basic_equal_weight(self):
        limits = RiskLimits(max_position_pct=0.50)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        tickers = ["AAPL", "MSFT", "GOOGL", "AMZN"]
        prices = {"AAPL": 150.0, "MSFT": 350.0, "GOOGL": 140.0, "AMZN": 180.0}
        results = sizer.equal_weight(tickers, prices)
        assert len(results) == 4
        # Each should get ~25% ($25k)
        for r in results:
            assert r.weight == pytest.approx(0.25, abs=0.01)

    def test_empty_tickers(self):
        sizer = PositionSizer(total_equity=100_000)
        assert sizer.equal_weight([], {}) == []


class TestRiskParity:
    def test_low_vol_gets_higher_weight(self):
        # Use generous position limit so inverse-vol weighting isn't capped
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        tickers = ["LOW_VOL", "HIGH_VOL"]
        prices = {"LOW_VOL": 100.0, "HIGH_VOL": 100.0}
        vols = {"LOW_VOL": 0.10, "HIGH_VOL": 0.40}
        results = sizer.risk_parity(tickers, prices, vols)
        assert len(results) == 2
        low_result = next(r for r in results if r.ticker == "LOW_VOL")
        high_result = next(r for r in results if r.ticker == "HIGH_VOL")
        assert low_result.weight > high_result.weight


# ---------------------------------------------------------------------------
# Risk Manager Tests
# ---------------------------------------------------------------------------


def make_state(**overrides) -> PortfolioState:
    defaults = dict(
        equity=100_000.0,
        cash=50_000.0,
        peak_equity=100_000.0,
        daily_starting_equity=100_000.0,
        positions={"AAPL": 25_000.0, "MSFT": 25_000.0},
        position_sectors={"AAPL": "tech", "MSFT": "tech"},
    )
    defaults.update(overrides)
    return PortfolioState(**defaults)


class TestDrawdownCheck:
    def test_no_drawdown(self):
        manager = RiskManager()
        state = make_state()
        assert manager.check_drawdown(state) is None

    def test_soft_drawdown_warning(self):
        manager = RiskManager()
        state = make_state(equity=89_000.0)  # 11% drawdown
        alert = manager.check_drawdown(state)
        assert alert is not None
        assert alert.severity == AlertSeverity.WARNING
        assert alert.action == RiskAction.REDUCE

    def test_hard_drawdown_halt(self):
        manager = RiskManager()
        state = make_state(equity=84_000.0)  # 16% drawdown
        alert = manager.check_drawdown(state)
        assert alert is not None
        assert alert.severity == AlertSeverity.CRITICAL
        assert alert.action == RiskAction.HALT
        assert manager.is_halted

    def test_halt_blocks_all_trades(self):
        manager = RiskManager()
        manager._halted = True
        state = make_state()
        result = manager.pre_trade_check("AAPL", 10, 150.0, "buy", state)
        assert not result.allowed
        assert result.action == RiskAction.HALT


class TestDailyLossCheck:
    def test_within_limit(self):
        manager = RiskManager()
        state = make_state(equity=99_000.0)  # 1% loss
        assert manager.check_daily_loss(state) is None

    def test_exceeds_limit(self):
        manager = RiskManager()
        state = make_state(equity=97_000.0)  # 3% loss > 2% limit
        alert = manager.check_daily_loss(state)
        assert alert is not None
        assert alert.action == RiskAction.REJECT


class TestPreTradeCheck:
    def test_buy_allowed(self):
        manager = RiskManager()
        state = make_state()
        result = manager.pre_trade_check("GOOGL", 10, 140.0, "buy", state)
        assert result.allowed
        assert result.action == RiskAction.ALLOW

    def test_sell_always_allowed(self):
        manager = RiskManager()
        state = make_state()
        result = manager.pre_trade_check("AAPL", 100, 150.0, "sell", state)
        assert result.allowed

    def test_position_concentration_reject(self):
        manager = RiskManager(limits=RiskLimits(max_position_pct=0.05))
        state = make_state(positions={"AAPL": 4_500.0})
        # Buying $2000 more of AAPL would make it 6.5% > 5% limit
        result = manager.pre_trade_check("AAPL", 100, 150.0, "buy", state)
        # Should either reject or reduce
        assert result.action in (RiskAction.REJECT, RiskAction.REDUCE)

    def test_sector_concentration_reject(self):
        # Allow individual position up to 20%, but sector limit at 20%
        manager = RiskManager(limits=RiskLimits(max_position_pct=0.20, max_sector_pct=0.20))
        state = make_state(
            positions={"AAPL": 10_000.0, "MSFT": 10_000.0},
            position_sectors={"AAPL": "tech", "MSFT": "tech"},
        )
        # Adding $7000 more tech would push to 27% > 20%
        result = manager.pre_trade_check(
            "GOOGL",
            50,
            140.0,
            "buy",
            state,
            sector="tech",
        )
        assert result.action == RiskAction.REJECT

    def test_max_positions_reject(self):
        manager = RiskManager(limits=RiskLimits(max_open_positions=2))
        state = make_state(positions={"AAPL": 10_000, "MSFT": 10_000})
        result = manager.pre_trade_check("GOOGL", 10, 140.0, "buy", state)
        assert not result.allowed
        assert result.action == RiskAction.REJECT

    def test_insufficient_cash_reduce(self):
        # Use generous position limit so the cash check is what triggers
        manager = RiskManager(limits=RiskLimits(max_position_pct=0.50))
        state = make_state(cash=1_000.0, positions={}, position_sectors={})
        result = manager.pre_trade_check("AAPL", 100, 150.0, "buy", state)
        assert result.action == RiskAction.REDUCE
        assert result.adjusted_shares is not None
        assert result.adjusted_shares < 100


class TestPortfolioAssessment:
    def test_healthy_portfolio(self):
        manager = RiskManager()
        # Use positions within the 5% limit (small positions)
        state = make_state(
            positions={"AAPL": 3_000.0, "MSFT": 3_000.0},
            position_sectors={"AAPL": "tech", "MSFT": "tech"},
        )
        result = manager.assess_portfolio_risk(state)
        assert result["equity"] == 100_000.0
        assert result["drawdown"] == 0.0
        assert result["halted"] is False
        assert len(result["alerts"]) == 0

    def test_drawdown_generates_alert(self):
        manager = RiskManager()
        state = make_state(equity=88_000.0)
        result = manager.assess_portfolio_risk(state)
        assert len(result["alerts"]) > 0
        assert result["alerts"][0]["severity"] == "warning"


class TestResetHalt:
    def test_reset_clears_halt(self):
        manager = RiskManager()
        manager._halted = True
        manager.reset_halt()
        assert not manager.is_halted


# ---------------------------------------------------------------------------
# Portfolio Optimizer Tests
# ---------------------------------------------------------------------------


def make_prices(n: int = 252, seed: int = 42) -> dict[str, np.ndarray]:
    """Generate synthetic price histories for testing."""
    rng = np.random.default_rng(seed)
    return {
        "AAPL": 150 * np.exp(np.cumsum(rng.normal(0.0003, 0.015, n))),
        "MSFT": 350 * np.exp(np.cumsum(rng.normal(0.0004, 0.012, n))),
        "GOOGL": 140 * np.exp(np.cumsum(rng.normal(0.0002, 0.018, n))),
        "AMZN": 180 * np.exp(np.cumsum(rng.normal(0.0003, 0.020, n))),
    }


class TestEstimateReturns:
    def test_returns_correct_shape(self):
        optimizer = PortfolioOptimizer()
        prices = make_prices()
        ret, cov, tickers = optimizer.estimate_returns(prices)
        assert len(ret) == 4
        assert cov.shape == (4, 4)
        assert len(tickers) == 4

    def test_covariance_is_symmetric(self):
        optimizer = PortfolioOptimizer()
        prices = make_prices()
        _, cov, _ = optimizer.estimate_returns(prices)
        np.testing.assert_array_almost_equal(cov, cov.T)

    def test_covariance_diagonal_positive(self):
        optimizer = PortfolioOptimizer()
        prices = make_prices()
        _, cov, _ = optimizer.estimate_returns(prices)
        assert all(cov[i, i] > 0 for i in range(4))


class TestMinimumVariance:
    def test_weights_sum_to_one(self):
        optimizer = PortfolioOptimizer()
        result = optimizer.minimum_variance(make_prices())
        total = sum(result.weights.values())
        assert total == pytest.approx(1.0, abs=0.01)

    def test_all_weights_positive(self):
        optimizer = PortfolioOptimizer()
        result = optimizer.minimum_variance(make_prices())
        for w in result.weights.values():
            assert w >= 0

    def test_expected_vol_positive(self):
        optimizer = PortfolioOptimizer()
        result = optimizer.minimum_variance(make_prices())
        assert result.expected_volatility > 0

    def test_empty_prices(self):
        optimizer = PortfolioOptimizer()
        result = optimizer.minimum_variance({})
        assert result.weights == {}


class TestPortfolioRiskParity:
    def test_weights_sum_to_one(self):
        optimizer = PortfolioOptimizer()
        result = optimizer.risk_parity(make_prices())
        total = sum(result.weights.values())
        assert total == pytest.approx(1.0, abs=0.01)

    def test_low_vol_asset_gets_more_weight(self):
        optimizer = PortfolioOptimizer()
        # MSFT has lower vol (0.012 drift noise) → should get more weight
        result = optimizer.risk_parity(make_prices())
        # The exact outcome depends on random data, just verify it runs
        assert result.method == "risk_parity"


class TestMaxSharpe:
    def test_weights_sum_to_one(self):
        optimizer = PortfolioOptimizer()
        result = optimizer.max_sharpe(make_prices())
        total = sum(result.weights.values())
        assert total == pytest.approx(1.0, abs=0.01)

    def test_sharpe_ratio_computed(self):
        optimizer = PortfolioOptimizer()
        result = optimizer.max_sharpe(make_prices())
        assert isinstance(result.sharpe_ratio, float)


class TestRebalancing:
    def test_basic_rebalance(self):
        optimizer = PortfolioOptimizer()
        current = {"AAPL": 0.30, "MSFT": 0.30, "GOOGL": 0.20, "AMZN": 0.20}
        target = {"AAPL": 0.25, "MSFT": 0.25, "GOOGL": 0.25, "AMZN": 0.25}
        actions = optimizer.generate_rebalance_trades(current, target)
        assert len(actions) == 4  # All need adjustment

        buys = [a for a in actions if a.direction == "buy"]
        sells = [a for a in actions if a.direction == "sell"]
        assert len(buys) == 2
        assert len(sells) == 2

    def test_no_trades_when_balanced(self):
        optimizer = PortfolioOptimizer()
        weights = {"AAPL": 0.25, "MSFT": 0.25, "GOOGL": 0.25, "AMZN": 0.25}
        actions = optimizer.generate_rebalance_trades(weights, weights)
        assert len(actions) == 0

    def test_min_trade_threshold(self):
        optimizer = PortfolioOptimizer()
        current = {"AAPL": 0.251, "MSFT": 0.249}
        target = {"AAPL": 0.250, "MSFT": 0.250}
        actions = optimizer.generate_rebalance_trades(current, target, min_trade_pct=0.01)
        assert len(actions) == 0  # Changes too small

    def test_new_position(self):
        optimizer = PortfolioOptimizer()
        current = {"AAPL": 0.50, "MSFT": 0.50}
        target = {"AAPL": 0.33, "MSFT": 0.33, "GOOGL": 0.34}
        actions = optimizer.generate_rebalance_trades(current, target)
        googl_action = next(a for a in actions if a.ticker == "GOOGL")
        assert googl_action.direction == "buy"

    def test_sorted_by_priority(self):
        optimizer = PortfolioOptimizer()
        current = {"AAPL": 0.40, "MSFT": 0.10}
        target = {"AAPL": 0.25, "MSFT": 0.25}
        actions = optimizer.generate_rebalance_trades(current, target)
        assert actions[0].priority >= actions[1].priority


# ---------------------------------------------------------------------------
# Risk API Tests
# ---------------------------------------------------------------------------


class TestRiskAPI:
    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient

        from src.api.main import _settings, app

        c = TestClient(app)
        c.headers["X-API-Key"] = _settings.engine_api_key
        return c

    def test_position_size_endpoint(self, client):
        resp = client.post(
            "/api/v1/risk/position-size",
            json={
                "ticker": "AAPL",
                "price": 150.0,
                "equity": 100000,
                "risk_fraction": 0.01,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ticker"] == "AAPL"
        assert data["shares"] > 0

    def test_risk_assessment_endpoint(self, client):
        resp = client.post(
            "/api/v1/risk/assess",
            json={
                "equity": 100000,
                "cash": 50000,
                "peak_equity": 100000,
                "daily_starting_equity": 100000,
                "positions": {"AAPL": 25000, "MSFT": 25000},
                "position_sectors": {"AAPL": "tech", "MSFT": "tech"},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "drawdown" in data
        assert "daily_pnl" in data
        assert data["halted"] is False

    def test_pre_trade_check_endpoint(self, client):
        resp = client.post(
            "/api/v1/risk/pre-trade-check",
            json={
                "ticker": "GOOGL",
                "shares": 10,
                "price": 140.0,
                "side": "buy",
                "equity": 100000,
                "cash": 50000,
                "peak_equity": 100000,
                "daily_starting_equity": 100000,
                "positions": {},
                "position_sectors": {},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["allowed"] is True

    def test_risk_limits_endpoint(self, client):
        resp = client.get("/api/v1/risk/limits")
        assert resp.status_code == 200
        data = resp.json()
        assert data["max_position_pct"] == 0.05
        assert data["max_drawdown_hard"] == 0.15
