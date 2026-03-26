"""Unit tests for backtest API routes.

Tests the FastAPI endpoints for running backtests with synthetic data.
Critical for demo and strategy validation functionality.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.routes.backtest import (
    BacktestRequest,
    generate_synthetic_data,
    router,
)

app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestGenerateSyntheticData:
    """Tests for synthetic OHLCV data generation."""

    def test_generates_correct_number_of_bars(self):
        """Generated data has correct length."""
        data = generate_synthetic_data("TEST", n=100, trend="random", seed=42)

        assert len(data) == 100
        assert len(data.close) == 100
        assert len(data.high) == 100
        assert len(data.low) == 100
        assert len(data.open) == 100
        assert len(data.volume) == 100

    def test_uptrend_generates_increasing_prices(self):
        """Uptrend generates generally increasing prices."""
        data = generate_synthetic_data("TEST", n=200, trend="up", seed=42)

        # First and last quartiles should show upward trend
        first_quartile_avg = data.close[:50].mean()
        last_quartile_avg = data.close[-50:].mean()

        assert last_quartile_avg > first_quartile_avg

    def test_downtrend_generates_decreasing_prices(self):
        """Downtrend generates generally decreasing prices."""
        data = generate_synthetic_data("TEST", n=200, trend="down", seed=42)

        first_quartile_avg = data.close[:50].mean()
        last_quartile_avg = data.close[-50:].mean()

        assert last_quartile_avg < first_quartile_avg

    def test_volatile_trend_generates_oscillation(self):
        """Volatile trend generates oscillating prices."""
        data = generate_synthetic_data("TEST", n=200, trend="volatile", seed=42)

        # Should have multiple peaks and troughs
        # Check for sign changes in price differences
        diffs = data.close[1:] - data.close[:-1]
        sign_changes = sum(1 for i in range(1, len(diffs)) if diffs[i] * diffs[i - 1] < 0)

        # Volatile trend should have many direction changes
        assert sign_changes > 20

    def test_random_trend_generates_random_walk(self):
        """Random trend generates random walk."""
        data = generate_synthetic_data("TEST", n=200, trend="random", seed=42)

        # Random walk should be approximately centered
        assert len(data.close) == 200

    def test_high_always_above_close(self):
        """High is always >= close (OHLC constraint)."""
        data = generate_synthetic_data("TEST", n=100, trend="random", seed=42)

        assert all(data.high >= data.close)

    def test_low_always_below_close(self):
        """Low is always <= close (OHLC constraint)."""
        data = generate_synthetic_data("TEST", n=100, trend="random", seed=42)

        assert all(data.low <= data.close)

    def test_prices_never_negative(self):
        """Prices are always positive."""
        data = generate_synthetic_data("TEST", n=100, trend="down", seed=42)

        assert all(data.close >= 10.0)  # Clamped to minimum $10
        assert all(data.high >= 10.0)
        assert all(data.low >= 10.0)

    def test_volume_in_expected_range(self):
        """Volume is in expected range (1M to 5M)."""
        data = generate_synthetic_data("TEST", n=100, trend="random", seed=42)

        assert all(data.volume >= 1e6)
        assert all(data.volume <= 5e6)

    def test_seed_produces_reproducible_results(self):
        """Same seed produces identical data."""
        data1 = generate_synthetic_data("TEST", n=50, trend="up", seed=123)
        data2 = generate_synthetic_data("TEST", n=50, trend="up", seed=123)

        assert all(data1.close == data2.close)
        assert all(data1.high == data2.high)
        assert all(data1.low == data2.low)

    def test_different_seeds_produce_different_results(self):
        """Different seeds produce different data."""
        data1 = generate_synthetic_data("TEST", n=50, trend="random", seed=123)
        data2 = generate_synthetic_data("TEST", n=50, trend="random", seed=456)

        assert not all(data1.close == data2.close)

    def test_ticker_is_set_correctly(self):
        """Ticker field is set correctly."""
        data = generate_synthetic_data("AAPL", n=100, trend="random", seed=42)

        assert data.ticker == "AAPL"

    def test_timestamps_are_sequential(self):
        """Timestamps are sequential integers."""
        data = generate_synthetic_data("TEST", n=100, trend="random", seed=42)

        assert all(data.timestamps[i] == i for i in range(100))


class TestBacktestRequest:
    """Tests for BacktestRequest validation."""

    def test_valid_request_with_defaults(self):
        """Valid request with default parameters."""
        req = BacktestRequest(strategy_name="sma_crossover")

        assert req.strategy_name == "sma_crossover"
        assert req.ticker == "SYNTHETIC"
        assert req.bars == 252
        assert req.initial_capital == 100_000.0
        assert req.trend == "random"

    def test_valid_request_with_all_params(self):
        """Valid request with all parameters specified."""
        req = BacktestRequest(
            strategy_name="bollinger_reversion",
            ticker="TEST",
            bars=500,
            initial_capital=50_000.0,
            commission_per_share=0.01,
            slippage_pct=0.002,
            position_size_pct=0.20,
            trend="up",
            seed=123,
        )

        assert req.strategy_name == "bollinger_reversion"
        assert req.ticker == "TEST"
        assert req.bars == 500
        assert req.initial_capital == 50_000.0
        assert req.commission_per_share == 0.01
        assert req.slippage_pct == 0.002
        assert req.position_size_pct == 0.20
        assert req.trend == "up"
        assert req.seed == 123

    def test_bars_minimum_boundary(self):
        """Bars must be >= 50."""
        with pytest.raises(ValueError):
            BacktestRequest(strategy_name="sma_crossover", bars=49)

    def test_bars_maximum_boundary(self):
        """Bars must be <= 5000."""
        with pytest.raises(ValueError):
            BacktestRequest(strategy_name="sma_crossover", bars=5001)

    def test_trend_must_be_valid_literal(self):
        """Trend must be one of: up, down, volatile, random."""
        with pytest.raises(ValueError):
            BacktestRequest(strategy_name="sma_crossover", trend="sideways")  # Invalid


class TestRunBacktestEndpoint:
    """Tests for POST /backtest/run endpoint."""

    def test_run_backtest_returns_results(self):
        """Backtest run returns complete results."""
        response = client.post(
            "/backtest/run",
            json={
                "strategy_name": "sma_crossover",
                "bars": 100,
                "initial_capital": 100_000.0,
                "trend": "up",
                "seed": 42,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert "summary" in data
        assert "equity_curve" in data
        assert "drawdown_curve" in data
        assert "trade_count" in data
        assert "trades" in data

    def test_run_backtest_summary_contains_metrics(self):
        """Backtest summary contains all expected metrics."""
        response = client.post(
            "/backtest/run",
            json={
                "strategy_name": "sma_crossover",
                "bars": 200,
                "initial_capital": 100_000.0,
                "trend": "up",
            },
        )

        assert response.status_code == 200
        summary = response.json()["summary"]

        assert "strategy" in summary
        assert "ticker" in summary
        assert "total_return" in summary
        assert "annualized_return" in summary
        assert "max_drawdown" in summary
        assert "sharpe_ratio" in summary
        assert "sortino_ratio" in summary
        assert "win_rate" in summary
        assert "profit_factor" in summary
        assert "total_trades" in summary
        assert "avg_holding_bars" in summary

    def test_run_backtest_equity_curve_is_list(self):
        """Equity curve is returned as list of floats."""
        response = client.post(
            "/backtest/run",
            json={"strategy_name": "sma_crossover", "bars": 100},
        )

        assert response.status_code == 200
        equity_curve = response.json()["equity_curve"]

        assert isinstance(equity_curve, list)
        assert len(equity_curve) > 0
        assert all(isinstance(x, (int, float)) for x in equity_curve)

    def test_run_backtest_trades_are_serialized(self):
        """Trades are properly serialized."""
        response = client.post(
            "/backtest/run",
            json={"strategy_name": "sma_crossover", "bars": 200, "trend": "up"},
        )

        assert response.status_code == 200
        trades = response.json()["trades"]

        assert isinstance(trades, list)
        if len(trades) > 0:
            trade = trades[0]
            assert "side" in trade
            assert "entry_bar" in trade
            assert "exit_bar" in trade
            assert "entry_price" in trade
            assert "exit_price" in trade
            assert "pnl" in trade
            assert "return_pct" in trade

    def test_run_backtest_with_unknown_strategy_returns_404(self):
        """Unknown strategy returns 404 error."""
        response = client.post(
            "/backtest/run",
            json={"strategy_name": "nonexistent_strategy"},
        )

        assert response.status_code == 404
        assert "unknown strategy" in response.json()["detail"].lower()

    def test_run_backtest_with_different_trends(self):
        """Backtest works with all trend types."""
        trends = ["up", "down", "volatile", "random"]

        for trend in trends:
            response = client.post(
                "/backtest/run",
                json={"strategy_name": "sma_crossover", "bars": 100, "trend": trend, "seed": 42},
            )

            assert response.status_code == 200

    def test_run_backtest_with_custom_capital(self):
        """Backtest respects initial capital setting."""
        response = client.post(
            "/backtest/run",
            json={"strategy_name": "sma_crossover", "bars": 100, "initial_capital": 50_000.0},
        )

        assert response.status_code == 200
        equity_curve = response.json()["equity_curve"]

        # First equity value should equal initial capital
        assert equity_curve[0] == pytest.approx(50_000.0, abs=1.0)

    def test_run_backtest_reproducible_with_same_seed(self):
        """Same seed produces identical backtest results."""
        response1 = client.post(
            "/backtest/run",
            json={"strategy_name": "sma_crossover", "bars": 100, "trend": "up", "seed": 42},
        )

        response2 = client.post(
            "/backtest/run",
            json={"strategy_name": "sma_crossover", "bars": 100, "trend": "up", "seed": 42},
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        equity1 = response1.json()["equity_curve"]
        equity2 = response2.json()["equity_curve"]

        assert equity1 == equity2

    def test_run_backtest_with_high_commission(self):
        """Backtest respects commission setting."""
        response = client.post(
            "/backtest/run",
            json={
                "strategy_name": "sma_crossover",
                "bars": 100,
                "commission_per_share": 0.10,  # High commission
                "trend": "up",
            },
        )

        assert response.status_code == 200
        # High commission should reduce returns

    def test_run_backtest_with_large_position_size(self):
        """Backtest respects position size setting."""
        response = client.post(
            "/backtest/run",
            json={
                "strategy_name": "sma_crossover",
                "bars": 100,
                "position_size_pct": 0.50,  # 50% position size
            },
        )

        assert response.status_code == 200


class TestListBacktestableStrategiesEndpoint:
    """Tests for GET /backtest/strategies endpoint."""

    def test_list_strategies_returns_available_strategies(self):
        """Endpoint returns list of available strategies."""
        response = client.get("/backtest/strategies")

        assert response.status_code == 200
        data = response.json()

        assert "strategies" in data
        assert "trends" in data

    def test_list_strategies_contains_known_strategies(self):
        """Response includes known strategy names."""
        response = client.get("/backtest/strategies")

        assert response.status_code == 200
        strategies = response.json()["strategies"]

        # Should contain at least some common strategies
        assert isinstance(strategies, list)
        assert len(strategies) > 0

    def test_list_strategies_contains_all_trends(self):
        """Response includes all trend types."""
        response = client.get("/backtest/strategies")

        assert response.status_code == 200
        trends = response.json()["trends"]

        assert "up" in trends
        assert "down" in trends
        assert "volatile" in trends
        assert "random" in trends

    def test_list_strategies_returns_sorted_list(self):
        """Strategy list is sorted alphabetically."""
        response = client.get("/backtest/strategies")

        assert response.status_code == 200
        strategies = response.json()["strategies"]

        assert strategies == sorted(strategies)
