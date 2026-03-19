"""Comprehensive tests for all strategy families."""

import numpy as np
import pytest

from src.strategies.base import OHLCVData, Signal, SignalDirection
from src.strategies.composite import CompositeStrategy
from src.strategies.mean_reversion import BollingerReversion, RSIMeanReversion, ZScoreReversion
from src.strategies.momentum import OBVDivergence, RateOfChangeMomentum, RSIMomentum
from src.strategies.pairs_trading import PairsSpreadTrading, compute_spread, rolling_correlation
from src.strategies.registry import (
    FAMILY_MAP,
    STRATEGY_CLASSES,
    create_composite,
    create_family,
    create_strategy,
    list_strategies,
)
from src.strategies.signal_generator import SignalBatch, SignalGenerator
from src.strategies.trend_following import EMAMomentumTrend, MACDTrend, SMACrossover
from src.strategies.value import PriceToMAValue, RelativeValue

# ---------------------------------------------------------------------------
# Test Data Factories
# ---------------------------------------------------------------------------


def make_data(
    ticker: str = "TEST",
    n: int = 100,
    trend: str = "flat",
    seed: int = 42,
) -> OHLCVData:
    """Create synthetic OHLCV data with controllable trend."""
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 0.5, n)

    if trend == "up":
        base = 100 + np.linspace(0, 30, n) + noise
    elif trend == "down":
        base = 130 - np.linspace(0, 30, n) + noise
    elif trend == "volatile":
        base = 100 + 10 * np.sin(np.linspace(0, 8 * np.pi, n)) + noise
    else:  # flat
        base = 100 + noise

    close = base.astype(np.float64)
    high = (close + rng.uniform(0.5, 2, n)).astype(np.float64)
    low = (close - rng.uniform(0.5, 2, n)).astype(np.float64)
    open_ = (close + rng.normal(0, 0.3, n)).astype(np.float64)
    volume = rng.uniform(1e6, 5e6, n).astype(np.float64)
    timestamps = np.arange(n, dtype=np.float64)

    return OHLCVData(
        ticker=ticker,
        timestamps=timestamps,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


def make_crossover_data(direction: str = "golden") -> OHLCVData:
    """Create data that produces an SMA crossover at the last bar.

    For a golden cross: price trends down then sharply up.
    For a death cross: price trends up then sharply down.
    """
    n = 80
    if direction == "golden":
        # Slow decline followed by sharp rise
        close = np.concatenate(
            [
                np.linspace(120, 100, 60),
                np.linspace(100, 130, 20),
            ]
        ).astype(np.float64)
    else:  # death
        close = np.concatenate(
            [
                np.linspace(100, 120, 60),
                np.linspace(120, 90, 20),
            ]
        ).astype(np.float64)

    np.random.default_rng(99)
    high = (close + 1).astype(np.float64)
    low = (close - 1).astype(np.float64)
    open_ = close.copy()
    volume = np.full(n, 2e6, dtype=np.float64)
    timestamps = np.arange(n, dtype=np.float64)

    return OHLCVData(
        ticker="CROSS",
        timestamps=timestamps,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


# ---------------------------------------------------------------------------
# Signal & OHLCVData Tests
# ---------------------------------------------------------------------------


class TestSignal:
    def test_valid_signal(self):
        sig = Signal(
            ticker="AAPL",
            direction=SignalDirection.LONG,
            strength=0.8,
            strategy_name="test",
            reason="test reason",
        )
        assert sig.ticker == "AAPL"
        assert sig.strength == 0.8

    def test_invalid_strength_raises(self):
        with pytest.raises(ValueError):
            Signal(
                ticker="X",
                direction=SignalDirection.LONG,
                strength=1.5,
                strategy_name="t",
                reason="r",
            )

    def test_negative_strength_raises(self):
        with pytest.raises(ValueError):
            Signal(
                ticker="X",
                direction=SignalDirection.LONG,
                strength=-0.1,
                strategy_name="t",
                reason="r",
            )


class TestOHLCVData:
    def test_len(self):
        data = make_data(n=50)
        assert len(data) == 50

    def test_last_close(self):
        data = make_data(n=10)
        assert data.last_close == float(data.close[-1])


# ---------------------------------------------------------------------------
# Trend Following Tests
# ---------------------------------------------------------------------------


class TestSMACrossover:
    def test_returns_empty_for_short_data(self):
        data = make_data(n=10)
        strategy = SMACrossover()
        assert strategy.generate_signals(data) == []

    def test_no_signal_in_flat_market(self):
        data = make_data(n=200, trend="flat")
        strategy = SMACrossover({"adx_threshold": 0.0})
        signals = strategy.generate_signals(data)
        # Flat market unlikely to produce crossovers
        assert len(signals) <= 1

    def test_strategy_name(self):
        strategy = SMACrossover()
        assert strategy.name == "sma_crossover"

    def test_custom_params(self):
        strategy = SMACrossover({"fast_period": 10, "slow_period": 30})
        assert strategy.params["fast_period"] == 10
        assert strategy.params["slow_period"] == 30


class TestEMAMomentumTrend:
    def test_uptrend_produces_long(self):
        data = make_data(n=100, trend="up")
        strategy = EMAMomentumTrend()
        signals = strategy.generate_signals(data)
        if signals:
            assert signals[0].direction == SignalDirection.LONG

    def test_downtrend_produces_short(self):
        data = make_data(n=100, trend="down")
        strategy = EMAMomentumTrend()
        signals = strategy.generate_signals(data)
        if signals:
            assert signals[0].direction == SignalDirection.SHORT

    def test_short_data_returns_empty(self):
        data = make_data(n=10)
        strategy = EMAMomentumTrend()
        assert strategy.generate_signals(data) == []


class TestMACDTrend:
    def test_returns_valid_signals(self):
        data = make_data(n=100, trend="up")
        strategy = MACDTrend()
        signals = strategy.generate_signals(data)
        for sig in signals:
            assert 0 <= sig.strength <= 1
            assert sig.strategy_name == "macd_trend"

    def test_short_data_returns_empty(self):
        data = make_data(n=20)
        strategy = MACDTrend()
        assert strategy.generate_signals(data) == []


# ---------------------------------------------------------------------------
# Momentum Tests
# ---------------------------------------------------------------------------


class TestRSIMomentum:
    def test_returns_valid_signals(self):
        data = make_data(n=100, trend="volatile")
        strategy = RSIMomentum()
        signals = strategy.generate_signals(data)
        for sig in signals:
            assert sig.strategy_name == "rsi_momentum"
            assert 0 <= sig.strength <= 1

    def test_short_data_returns_empty(self):
        data = make_data(n=5)
        strategy = RSIMomentum()
        assert strategy.generate_signals(data) == []


class TestRateOfChangeMomentum:
    def test_returns_valid_signals(self):
        data = make_data(n=100, trend="up")
        strategy = RateOfChangeMomentum({"volume_multiplier": 0.0})
        signals = strategy.generate_signals(data)
        for sig in signals:
            assert sig.strategy_name == "roc_momentum"


class TestOBVDivergence:
    def test_short_data_returns_empty(self):
        data = make_data(n=10)
        strategy = OBVDivergence()
        assert strategy.generate_signals(data) == []


# ---------------------------------------------------------------------------
# Mean Reversion Tests
# ---------------------------------------------------------------------------


class TestBollingerReversion:
    def test_returns_valid_signals(self):
        data = make_data(n=100, trend="volatile")
        strategy = BollingerReversion()
        signals = strategy.generate_signals(data)
        for sig in signals:
            assert sig.strategy_name == "bollinger_reversion"


class TestZScoreReversion:
    def test_extreme_low_produces_long(self):
        # Create data with mild noise (non-zero std) then extreme low at end
        rng = np.random.default_rng(42)
        close = np.concatenate(
            [
                100.0 + rng.normal(0, 1.0, 55),  # Normal variation around 100
                np.array([80.0]),  # Extreme low
            ]
        ).astype(np.float64)
        n = len(close)
        data = OHLCVData(
            ticker="LOW",
            timestamps=np.arange(n, dtype=np.float64),
            open=close.copy(),
            high=(close + 1).astype(np.float64),
            low=(close - 1).astype(np.float64),
            close=close,
            volume=np.full(n, 1e6, dtype=np.float64),
        )
        strategy = ZScoreReversion({"lookback": 50, "entry_z": 1.5})
        signals = strategy.generate_signals(data)
        assert len(signals) == 1
        assert signals[0].direction == SignalDirection.LONG

    def test_extreme_high_produces_short(self):
        rng = np.random.default_rng(42)
        close = np.concatenate(
            [
                100.0 + rng.normal(0, 1.0, 55),
                np.array([120.0]),
            ]
        ).astype(np.float64)
        n = len(close)
        data = OHLCVData(
            ticker="HIGH",
            timestamps=np.arange(n, dtype=np.float64),
            open=close.copy(),
            high=(close + 1).astype(np.float64),
            low=(close - 1).astype(np.float64),
            close=close,
            volume=np.full(n, 1e6, dtype=np.float64),
        )
        strategy = ZScoreReversion({"lookback": 50, "entry_z": 1.5})
        signals = strategy.generate_signals(data)
        assert len(signals) == 1
        assert signals[0].direction == SignalDirection.SHORT


class TestRSIMeanReversion:
    def test_returns_valid_signals(self):
        data = make_data(n=100, trend="volatile")
        strategy = RSIMeanReversion()
        signals = strategy.generate_signals(data)
        for sig in signals:
            assert sig.strategy_name == "rsi_mean_reversion"


# ---------------------------------------------------------------------------
# Value Tests
# ---------------------------------------------------------------------------


class TestPriceToMAValue:
    def test_needs_long_data(self):
        data = make_data(n=50)
        strategy = PriceToMAValue()
        assert strategy.generate_signals(data) == []

    def test_returns_valid_signals_with_enough_data(self):
        data = make_data(n=250, trend="down")
        strategy = PriceToMAValue()
        signals = strategy.generate_signals(data)
        for sig in signals:
            assert sig.strategy_name == "price_to_ma_value"


class TestRelativeValue:
    def test_short_data_returns_empty(self):
        data = make_data(n=20)
        strategy = RelativeValue()
        assert strategy.generate_signals(data) == []


# ---------------------------------------------------------------------------
# Pairs Trading Tests
# ---------------------------------------------------------------------------


class TestComputeSpread:
    def test_identical_series_zero_spread(self):
        a = np.array([100.0, 101, 102, 103, 104])
        spread, beta, intercept = compute_spread(a, a)
        assert beta == pytest.approx(1.0, abs=0.01)
        np.testing.assert_array_almost_equal(spread, np.zeros(5), decimal=10)

    def test_proportional_series(self):
        a = np.array([100.0, 110, 120, 130, 140])
        b = np.array([50.0, 55, 60, 65, 70])
        spread, beta, _ = compute_spread(a, b)
        assert beta == pytest.approx(1.0, abs=0.01)


class TestRollingCorrelation:
    def test_perfect_correlation(self):
        a = np.array([1.0, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        b = np.array([2.0, 4, 6, 8, 10, 12, 14, 16, 18, 20])
        corr = rolling_correlation(a, b, 5)
        assert corr[4] == pytest.approx(1.0)

    def test_negative_correlation(self):
        a = np.array([1.0, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        b = np.array([20.0, 18, 16, 14, 12, 10, 8, 6, 4, 2])
        corr = rolling_correlation(a, b, 5)
        assert corr[4] == pytest.approx(-1.0)


class TestPairsSpreadTrading:
    def test_single_instrument_returns_empty(self):
        data = make_data(n=100)
        strategy = PairsSpreadTrading()
        assert strategy.generate_signals(data) == []

    def test_pair_signals_with_correlated_data(self):
        rng = np.random.default_rng(42)
        n = 100
        base = 100 + np.cumsum(rng.normal(0, 1, n))
        close_a = base.astype(np.float64)
        close_b = (base * 0.5 + 10 + rng.normal(0, 0.1, n)).astype(np.float64)

        data_a = OHLCVData(
            ticker="A",
            timestamps=np.arange(n, dtype=np.float64),
            open=close_a,
            high=close_a + 1,
            low=close_a - 1,
            close=close_a,
            volume=np.full(n, 1e6, dtype=np.float64),
        )
        data_b = OHLCVData(
            ticker="B",
            timestamps=np.arange(n, dtype=np.float64),
            open=close_b,
            high=close_b + 1,
            low=close_b - 1,
            close=close_b,
            volume=np.full(n, 1e6, dtype=np.float64),
        )

        strategy = PairsSpreadTrading()
        signals = strategy.generate_pair_signals(data_a, data_b)
        # May or may not produce signals depending on z-score
        for sig in signals:
            assert sig.strategy_name == "pairs_spread"
            assert "pair" in sig.metadata


# ---------------------------------------------------------------------------
# Composite Tests
# ---------------------------------------------------------------------------


class TestCompositeStrategy:
    def test_empty_when_no_child_signals(self):
        data = make_data(n=10)  # Too short for any strategy
        strategies = [
            (SMACrossover(), 1.0),
            (RSIMomentum(), 1.0),
        ]
        composite = CompositeStrategy(strategies=strategies)
        assert composite.generate_signals(data) == []

    def test_consensus_required(self):
        """Composite needs min_agreement strategies to agree."""
        data = make_data(n=200, trend="up")
        strategies = [
            (EMAMomentumTrend(), 1.0),
            (SMACrossover({"adx_threshold": 0.0}), 1.0),
            (MACDTrend(), 1.0),
        ]
        composite = CompositeStrategy(
            strategies=strategies,
            params={"min_agreement": 2, "min_strength": 0.05},
        )
        signals = composite.generate_signals(data)
        for sig in signals:
            assert sig.strategy_name == "composite"
            assert sig.metadata.get("signal_count", 0) >= 2


# ---------------------------------------------------------------------------
# Registry Tests
# ---------------------------------------------------------------------------


class TestRegistry:
    def test_all_strategies_registered(self):
        assert len(STRATEGY_CLASSES) >= 11

    def test_create_strategy(self):
        strategy = create_strategy("sma_crossover")
        assert strategy.name == "sma_crossover"

    def test_create_unknown_raises(self):
        with pytest.raises(KeyError):
            create_strategy("nonexistent")

    def test_create_family(self):
        trend = create_family("trend_following")
        assert len(trend) == 3

    def test_create_unknown_family_raises(self):
        with pytest.raises(KeyError):
            create_family("nonexistent")

    def test_create_composite(self):
        composite = create_composite()
        assert composite.name == "composite"
        assert len(composite.strategies) > 0

    def test_list_strategies(self):
        result = list_strategies()
        assert len(result) >= 11
        for name, info in result.items():
            assert "name" in info
            assert "family" in info
            assert "description" in info

    def test_all_families_have_strategies(self):
        for family, names in FAMILY_MAP.items():
            if family != "composite":
                assert len(names) > 0, f"Family {family} has no strategies"


# ---------------------------------------------------------------------------
# Signal Generator Tests
# ---------------------------------------------------------------------------


class TestSignalGenerator:
    def test_scan_empty_data(self):
        gen = SignalGenerator()
        batch = gen.scan({})
        assert batch.total_signals == 0
        assert batch.tickers_scanned == 0

    def test_scan_multiple_tickers(self):
        data_map = {
            "AAPL": make_data(ticker="AAPL", n=100, trend="up"),
            "MSFT": make_data(ticker="MSFT", n=100, trend="down"),
            "GOOGL": make_data(ticker="GOOGL", n=100, trend="volatile"),
        }
        gen = SignalGenerator(min_signal_strength=0.0)
        batch = gen.scan(data_map)
        assert batch.tickers_scanned == 3
        assert batch.strategies_run > 0

    def test_signal_batch_properties(self):
        batch = SignalBatch(
            signals=[
                Signal(
                    ticker="A",
                    direction=SignalDirection.LONG,
                    strength=0.8,
                    strategy_name="s1",
                    reason="r1",
                ),
                Signal(
                    ticker="B",
                    direction=SignalDirection.SHORT,
                    strength=0.6,
                    strategy_name="s2",
                    reason="r2",
                ),
                Signal(
                    ticker="C",
                    direction=SignalDirection.LONG,
                    strength=0.9,
                    strategy_name="s3",
                    reason="r3",
                ),
            ],
            tickers_scanned=3,
            strategies_run=9,
        )
        assert batch.total_signals == 3
        assert len(batch.long_signals) == 2
        assert len(batch.short_signals) == 1
        assert batch.top_signals(2)[0].strength == 0.9

    def test_scan_filters_by_min_strength(self):
        data_map = {"TEST": make_data(n=100, trend="up")}
        gen = SignalGenerator(min_signal_strength=0.99)
        batch = gen.scan(data_map)
        for sig in batch.signals:
            assert sig.strength >= 0.99

    def test_scan_limits_per_ticker(self):
        data_map = {"TEST": make_data(n=100, trend="volatile")}
        gen = SignalGenerator(
            strategies=[
                create_strategy("rsi_momentum"),
                create_strategy("bollinger_reversion"),
                create_strategy("zscore_reversion"),
                create_strategy("rsi_mean_reversion"),
            ],
            min_signal_strength=0.0,
            max_signals_per_ticker=2,
        )
        batch = gen.scan(data_map)
        assert len([s for s in batch.signals if s.ticker == "TEST"]) <= 2

    def test_handles_strategy_error_gracefully(self):
        """If a strategy throws, it should be captured in errors."""

        class BrokenStrategy:
            name = "broken"

            def generate_signals(self, data):
                raise RuntimeError("💥 kaboom")

        gen = SignalGenerator(strategies=[BrokenStrategy()], min_signal_strength=0.0)
        batch = gen.scan({"TEST": make_data(n=100)})
        assert len(batch.errors) == 1
        assert "broken" in batch.errors[0]

    def test_composite_scan(self):
        data_map = {
            "AAPL": make_data(ticker="AAPL", n=200, trend="up"),
        }
        gen = SignalGenerator()
        batch = gen.scan_with_composite(data_map)
        assert batch.tickers_scanned == 1
