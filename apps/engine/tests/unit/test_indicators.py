"""Comprehensive tests for the technical indicator library."""

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays

from src.strategies.indicators import (
    atr,
    bollinger_bands,
    ema,
    macd,
    obv,
    rate_of_change,
    rsi,
    sma,
    stochastic,
    true_range,
    vwap,
    williams_r,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_close(values: list[float]) -> np.ndarray:
    return np.array(values, dtype=np.float64)


def make_ohlcv(n: int = 50, seed: int = 42):
    """Generate synthetic OHLCV data."""
    rng = np.random.default_rng(seed)
    close = 100.0 + np.cumsum(rng.normal(0, 1, n))
    high = close + rng.uniform(0.5, 2.0, n)
    low = close - rng.uniform(0.5, 2.0, n)
    open_ = close + rng.normal(0, 0.5, n)
    volume = rng.uniform(1e6, 5e6, n)
    return open_, high, low, close, volume


# ---------------------------------------------------------------------------
# SMA Tests
# ---------------------------------------------------------------------------


class TestSMA:
    def test_period_1_equals_close(self):
        close = make_close([10, 20, 30, 40, 50])
        result = sma(close, 1)
        np.testing.assert_array_almost_equal(result, close)

    def test_basic_calculation(self):
        close = make_close([1, 2, 3, 4, 5])
        result = sma(close, 3)
        assert np.isnan(result[0])
        assert np.isnan(result[1])
        assert result[2] == pytest.approx(2.0)
        assert result[3] == pytest.approx(3.0)
        assert result[4] == pytest.approx(4.0)

    def test_warmup_nans(self):
        close = make_close([10, 20, 30, 40, 50])
        result = sma(close, 3)
        assert np.isnan(result[0])
        assert np.isnan(result[1])
        assert not np.isnan(result[2])

    def test_period_equals_length(self):
        close = make_close([2, 4, 6])
        result = sma(close, 3)
        assert result[2] == pytest.approx(4.0)

    def test_insufficient_data(self):
        close = make_close([1, 2])
        result = sma(close, 5)
        assert all(np.isnan(result))

    def test_invalid_period_raises(self):
        with pytest.raises(ValueError):
            sma(make_close([1, 2, 3]), 0)

    @given(
        arrays(np.float64, st.integers(5, 50), elements=st.floats(1, 1000, allow_nan=False)),
        st.integers(1, 10),
    )
    @settings(max_examples=20)
    def test_sma_length_matches_input(self, close, period):
        result = sma(close, period)
        assert len(result) == len(close)


# ---------------------------------------------------------------------------
# EMA Tests
# ---------------------------------------------------------------------------


class TestEMA:
    def test_basic_ema(self):
        close = make_close([10, 11, 12, 13, 14, 15])
        result = ema(close, 3)
        # First valid at index 2 (SMA seed)
        assert result[2] == pytest.approx(11.0)
        # EMA[3] = (13 - 11) * 0.5 + 11 = 12.0
        assert result[3] == pytest.approx(12.0)

    def test_warmup_nans(self):
        close = make_close([1, 2, 3, 4, 5])
        result = ema(close, 3)
        assert np.isnan(result[0])
        assert np.isnan(result[1])
        assert not np.isnan(result[2])

    def test_ema_smoother_than_sma(self):
        """EMA should react faster to recent changes."""
        close = make_close([10, 10, 10, 10, 20])
        ema_vals = ema(close, 3)
        sma_vals = sma(close, 3)
        # EMA should be closer to 20 than SMA at the end
        assert ema_vals[4] > sma_vals[4]

    def test_insufficient_data(self):
        close = make_close([1])
        result = ema(close, 5)
        assert all(np.isnan(result))


# ---------------------------------------------------------------------------
# RSI Tests
# ---------------------------------------------------------------------------


class TestRSI:
    def test_all_gains_gives_100(self):
        close = make_close([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24])
        result = rsi(close, 14)
        assert result[14] == pytest.approx(100.0)

    def test_all_losses_gives_0(self):
        close = make_close([24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10])
        result = rsi(close, 14)
        assert result[14] == pytest.approx(0.0)

    def test_rsi_range(self):
        _, _, _, close, _ = make_ohlcv(100)
        result = rsi(close, 14)
        valid = result[~np.isnan(result)]
        assert all(0 <= v <= 100 for v in valid)

    def test_warmup_period(self):
        _, _, _, close, _ = make_ohlcv(50)
        result = rsi(close, 14)
        # First 14 values should be NaN
        assert all(np.isnan(result[:14]))
        assert not np.isnan(result[14])

    def test_invalid_period(self):
        with pytest.raises(ValueError):
            rsi(make_close([1, 2, 3]), 0)


# ---------------------------------------------------------------------------
# MACD Tests
# ---------------------------------------------------------------------------


class TestMACD:
    def test_macd_components(self):
        _, _, _, close, _ = make_ohlcv(100)
        macd_line, signal_line, histogram = macd(close)
        # MACD = fast EMA - slow EMA
        assert len(macd_line) == len(close)
        assert len(signal_line) == len(close)
        assert len(histogram) == len(close)

    def test_histogram_is_difference(self):
        _, _, _, close, _ = make_ohlcv(100)
        macd_line, signal_line, histogram = macd(close)
        # Where both are valid, histogram = macd - signal
        for i in range(len(close)):
            if not np.isnan(macd_line[i]) and not np.isnan(signal_line[i]):
                assert histogram[i] == pytest.approx(macd_line[i] - signal_line[i], abs=1e-10)

    def test_insufficient_data(self):
        close = make_close([1, 2, 3])
        macd_line, _, _ = macd(close)
        assert all(np.isnan(macd_line))


# ---------------------------------------------------------------------------
# Bollinger Bands Tests
# ---------------------------------------------------------------------------


class TestBollingerBands:
    def test_upper_above_middle_above_lower(self):
        _, _, _, close, _ = make_ohlcv(50)
        upper, middle, lower = bollinger_bands(close, 20)
        for i in range(19, 50):
            assert upper[i] >= middle[i] >= lower[i]

    def test_middle_is_sma(self):
        _, _, _, close, _ = make_ohlcv(50)
        _, middle, _ = bollinger_bands(close, 20)
        sma_vals = sma(close, 20)
        np.testing.assert_array_almost_equal(middle, sma_vals)

    def test_band_width_scales_with_std(self):
        close = make_close([100] * 20)  # Zero volatility
        upper, middle, lower = bollinger_bands(close, 20)
        assert upper[19] == pytest.approx(middle[19])
        assert lower[19] == pytest.approx(middle[19])


# ---------------------------------------------------------------------------
# ATR Tests
# ---------------------------------------------------------------------------


class TestATR:
    def test_atr_positive(self):
        _, high, low, close, _ = make_ohlcv(50)
        result = atr(high, low, close, 14)
        valid = result[~np.isnan(result)]
        assert all(v > 0 for v in valid)

    def test_true_range_single_bar(self):
        high = np.array([110.0])
        low = np.array([90.0])
        close = np.array([100.0])
        tr = true_range(high, low, close)
        assert tr[0] == pytest.approx(20.0)

    def test_atr_warmup(self):
        _, high, low, close, _ = make_ohlcv(30)
        result = atr(high, low, close, 14)
        assert all(np.isnan(result[:14]))
        assert not np.isnan(result[14])


# ---------------------------------------------------------------------------
# Stochastic Tests
# ---------------------------------------------------------------------------


class TestStochastic:
    def test_range_0_100(self):
        _, high, low, close, _ = make_ohlcv(50)
        k, d = stochastic(high, low, close)
        valid_k = k[~np.isnan(k)]
        assert all(0 <= v <= 100 for v in valid_k)

    def test_d_is_sma_of_k(self):
        _, high, low, close, _ = make_ohlcv(50)
        k, d = stochastic(high, low, close, k_period=14, d_period=3)
        # %D should be SMA of %K
        k_sma = sma(k, 3)
        for i in range(len(d)):
            if not np.isnan(d[i]) and not np.isnan(k_sma[i]):
                assert d[i] == pytest.approx(k_sma[i], abs=1e-10)


# ---------------------------------------------------------------------------
# Volume Indicators Tests
# ---------------------------------------------------------------------------


class TestOBV:
    def test_increasing_prices(self):
        close = make_close([10, 11, 12, 13, 14])
        volume = make_close([100, 200, 300, 400, 500])
        result = obv(close, volume)
        # All up days: OBV should be cumulative
        assert result[0] == 100
        assert result[1] == 300  # 100 + 200
        assert result[4] == 1500  # 100+200+300+400+500

    def test_decreasing_prices(self):
        close = make_close([14, 13, 12, 11, 10])
        volume = make_close([100, 200, 300, 400, 500])
        result = obv(close, volume)
        assert result[1] == -100  # 100 - 200

    def test_flat_price(self):
        close = make_close([10, 10, 10])
        volume = make_close([100, 200, 300])
        result = obv(close, volume)
        assert result[1] == 100  # No change = keep previous


class TestVWAP:
    def test_uniform_volume(self):
        high = make_close([11, 12, 13])
        low = make_close([9, 10, 11])
        close = make_close([10, 11, 12])
        volume = make_close([100, 100, 100])
        result = vwap(high, low, close, volume)
        # With uniform volume, VWAP = cumulative typical price average
        assert len(result) == 3


# ---------------------------------------------------------------------------
# Rate of Change Tests
# ---------------------------------------------------------------------------


class TestROC:
    def test_basic_roc(self):
        close = make_close([100, 110, 120, 130, 140])
        result = rate_of_change(close, 1)
        assert result[1] == pytest.approx(10.0)
        assert result[2] == pytest.approx(9.0909, abs=0.01)

    def test_negative_roc(self):
        close = make_close([100, 90, 80])
        result = rate_of_change(close, 1)
        assert result[1] == pytest.approx(-10.0)


class TestWilliamsR:
    def test_range(self):
        _, high, low, close, _ = make_ohlcv(50)
        result = williams_r(high, low, close)
        valid = result[~np.isnan(result)]
        assert all(-100 <= v <= 0 for v in valid)
