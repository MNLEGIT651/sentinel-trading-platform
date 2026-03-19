"""Comprehensive tests for the backtesting framework."""

import numpy as np
import pytest

from src.backtest.engine import BacktestEngine, BacktestResult, EquityCurve
from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy
from src.strategies.mean_reversion import ZScoreReversion
from src.strategies.trend_following import EMAMomentumTrend

# ---------------------------------------------------------------------------
# Test Data
# ---------------------------------------------------------------------------


def make_trending_data(direction: str = "up", n: int = 200, seed: int = 42) -> OHLCVData:
    """Generate trending OHLCV data for backtesting."""
    rng = np.random.default_rng(seed)
    if direction == "up":
        base = 100 + np.linspace(0, 50, n) + np.cumsum(rng.normal(0, 0.3, n))
    elif direction == "down":
        base = 150 - np.linspace(0, 50, n) + np.cumsum(rng.normal(0, 0.3, n))
    else:  # volatile
        base = 100 + 10 * np.sin(np.linspace(0, 8 * np.pi, n)) + np.cumsum(rng.normal(0, 0.5, n))

    close = np.maximum(base, 10.0).astype(np.float64)
    high = (close + rng.uniform(0.5, 2.0, n)).astype(np.float64)
    low = (close - rng.uniform(0.5, 2.0, n)).astype(np.float64)
    open_ = (close + rng.normal(0, 0.3, n)).astype(np.float64)
    volume = rng.uniform(1e6, 5e6, n).astype(np.float64)

    return OHLCVData(
        ticker="TEST",
        timestamps=np.arange(n, dtype=np.float64),
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


class AlwaysLongStrategy(Strategy):
    """Test strategy that always signals long."""

    def __init__(self):
        super().__init__(name="always_long", description="Always long test strategy")

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        return [
            Signal(
                ticker=data.ticker,
                direction=SignalDirection.LONG,
                strength=0.8,
                strategy_name=self.name,
                reason="Test",
            )
        ]


class AlternatingStrategy(Strategy):
    """Test strategy that alternates between long and short."""

    def __init__(self):
        super().__init__(name="alternating", description="Alternating test strategy")

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        bar = len(data) - 1
        direction = SignalDirection.LONG if (bar // 10) % 2 == 0 else SignalDirection.SHORT
        return [
            Signal(
                ticker=data.ticker,
                direction=direction,
                strength=0.7,
                strategy_name=self.name,
                reason="Alternating",
            )
        ]


class NeverSignalStrategy(Strategy):
    """Test strategy that never produces signals."""

    def __init__(self):
        super().__init__(name="never_signal", description="Never signals")

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        return []


# ---------------------------------------------------------------------------
# BacktestEngine Tests
# ---------------------------------------------------------------------------


class TestBacktestEngine:
    def test_basic_run(self):
        engine = BacktestEngine(initial_capital=100_000)
        data = make_trending_data("up")
        result = engine.run(AlwaysLongStrategy(), data)
        assert isinstance(result, BacktestResult)
        assert result.strategy_name == "always_long"
        assert result.ticker == "TEST"
        assert result.initial_capital == 100_000

    def test_equity_curve_length(self):
        engine = BacktestEngine()
        data = make_trending_data("up", n=100)
        result = engine.run(AlwaysLongStrategy(), data)
        assert len(result.equity_curve.equity) == 100

    def test_uptrend_long_profitable(self):
        """Long strategy in uptrend should be profitable."""
        engine = BacktestEngine()
        data = make_trending_data("up", n=200)
        result = engine.run(AlwaysLongStrategy(), data)
        assert result.total_return > 0
        assert result.final_equity > result.initial_capital

    def test_no_signals_preserves_capital(self):
        """Strategy that never signals should preserve initial capital."""
        engine = BacktestEngine()
        data = make_trending_data("up")
        result = engine.run(NeverSignalStrategy(), data)
        assert result.total_trades == 0
        assert result.final_equity == pytest.approx(100_000, abs=0.01)

    def test_commission_reduces_returns(self):
        """Higher commission should reduce returns."""
        data = make_trending_data("up")
        strategy = AlwaysLongStrategy()

        low_comm = BacktestEngine(commission_per_share=0.001)
        high_comm = BacktestEngine(commission_per_share=0.10)

        result_low = low_comm.run(strategy, data)
        result_high = high_comm.run(strategy, data)

        assert result_low.final_equity >= result_high.final_equity

    def test_slippage_reduces_returns(self):
        """Higher slippage should reduce returns."""
        data = make_trending_data("up")
        strategy = AlwaysLongStrategy()

        low_slip = BacktestEngine(slippage_pct=0.0001)
        high_slip = BacktestEngine(slippage_pct=0.01)

        result_low = low_slip.run(strategy, data)
        result_high = high_slip.run(strategy, data)

        assert result_low.final_equity >= result_high.final_equity

    def test_alternating_strategy_produces_trades(self):
        """Alternating strategy should produce multiple trades."""
        engine = BacktestEngine()
        data = make_trending_data("volatile", n=200)
        result = engine.run(AlternatingStrategy(), data)
        assert result.total_trades > 1

    def test_max_holding_bars(self):
        """Max holding should force exits."""
        engine = BacktestEngine(max_holding_bars=20)
        data = make_trending_data("up", n=200)
        result = engine.run(AlwaysLongStrategy(), data)
        for trade in result.trades:
            assert trade.holding_bars <= 20

    def test_trade_records_have_valid_fields(self):
        engine = BacktestEngine()
        data = make_trending_data("up")
        result = engine.run(AlternatingStrategy(), data)
        for trade in result.trades:
            assert trade.entry_price > 0
            assert trade.exit_price > 0
            assert trade.shares > 0
            assert trade.entry_bar < trade.exit_bar
            assert trade.holding_bars == trade.exit_bar - trade.entry_bar
            assert trade.side in ("long", "short")


class TestPerformanceMetrics:
    def test_sharpe_ratio_type(self):
        engine = BacktestEngine()
        result = engine.run(AlwaysLongStrategy(), make_trending_data("up"))
        assert isinstance(result.sharpe_ratio, float)

    def test_sortino_ratio_type(self):
        engine = BacktestEngine()
        result = engine.run(AlwaysLongStrategy(), make_trending_data("up"))
        assert isinstance(result.sortino_ratio, float)

    def test_win_rate_range(self):
        engine = BacktestEngine()
        result = engine.run(AlternatingStrategy(), make_trending_data("volatile"))
        assert 0 <= result.win_rate <= 1

    def test_max_drawdown_negative(self):
        engine = BacktestEngine()
        result = engine.run(AlwaysLongStrategy(), make_trending_data("volatile"))
        assert result.max_drawdown <= 0

    def test_summary_contains_key_metrics(self):
        engine = BacktestEngine()
        result = engine.run(AlwaysLongStrategy(), make_trending_data("up"))
        summary = result.summary()
        assert "total_return" in summary
        assert "sharpe_ratio" in summary
        assert "max_drawdown" in summary
        assert "win_rate" in summary


class TestEquityCurve:
    def test_total_return(self):
        curve = EquityCurve(
            timestamps=np.array([0, 1, 2], dtype=np.float64),
            equity=np.array([100, 110, 120], dtype=np.float64),
            cash=np.array([100, 100, 100], dtype=np.float64),
            drawdown=np.array([0, 0, 0], dtype=np.float64),
        )
        assert curve.total_return == pytest.approx(0.20)

    def test_max_drawdown(self):
        curve = EquityCurve(
            timestamps=np.array([0, 1, 2], dtype=np.float64),
            equity=np.array([100, 90, 95], dtype=np.float64),
            cash=np.array([100, 100, 100], dtype=np.float64),
            drawdown=np.array([0, -0.10, -0.05], dtype=np.float64),
        )
        assert curve.max_drawdown == pytest.approx(-0.10)


class TestWithRealStrategies:
    def test_ema_trend_strategy(self):
        engine = BacktestEngine()
        data = make_trending_data("up", n=200)
        strategy = EMAMomentumTrend()
        result = engine.run(strategy, data)
        assert isinstance(result, BacktestResult)

    def test_zscore_reversion_strategy(self):
        engine = BacktestEngine()
        data = make_trending_data("volatile", n=200)
        strategy = ZScoreReversion()
        result = engine.run(strategy, data)
        assert isinstance(result, BacktestResult)


# ---------------------------------------------------------------------------
# Backtest API Tests
# ---------------------------------------------------------------------------


class TestBacktestAPI:
    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient

        from src.api.main import _settings, app

        c = TestClient(app)
        c.headers["X-API-Key"] = _settings.engine_api_key
        return c

    def test_run_backtest(self, client):
        resp = client.post(
            "/api/v1/backtest/run",
            json={
                "strategy_name": "sma_crossover",
                "bars": 200,
                "trend": "up",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "summary" in data
        assert "equity_curve" in data
        assert len(data["equity_curve"]) == 200

    def test_run_backtest_unknown_strategy(self, client):
        resp = client.post(
            "/api/v1/backtest/run",
            json={
                "strategy_name": "nonexistent",
            },
        )
        assert resp.status_code == 404

    def test_list_backtestable_strategies(self, client):
        resp = client.get("/api/v1/backtest/strategies")
        assert resp.status_code == 200
        data = resp.json()
        assert "sma_crossover" in data["strategies"]
        assert "up" in data["trends"]

    def test_run_backtest_volatile(self, client):
        resp = client.post(
            "/api/v1/backtest/run",
            json={
                "strategy_name": "bollinger_reversion",
                "bars": 300,
                "trend": "volatile",
                "seed": 99,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["strategy"] == "bollinger_reversion"

    def test_backtest_with_custom_capital(self, client):
        resp = client.post(
            "/api/v1/backtest/run",
            json={
                "strategy_name": "rsi_momentum",
                "initial_capital": 50000,
                "bars": 150,
            },
        )
        assert resp.status_code == 200

    def test_backtest_response_includes_trades(self, client) -> None:
        """Backtest response should include a trades list."""
        payload = {
            "strategy_name": "sma_crossover",
            "bars": 100,
            "trend": "up",
            "seed": 1,
        }
        response = client.post("/api/v1/backtest/run", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "trades" in data
        assert isinstance(data["trades"], list)
        if data["trades"]:
            trade = data["trades"][0]
            assert "side" in trade
            assert "entry_price" in trade
            assert "pnl" in trade
            assert "return_pct" in trade
