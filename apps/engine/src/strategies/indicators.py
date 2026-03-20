"""Pure NumPy technical indicator library.

All functions operate on 1-D numpy arrays and return arrays of the same length.
NaN is used for the warm-up period where insufficient data exists.
"""

from __future__ import annotations

from collections.abc import Callable, Generator
from contextlib import contextmanager
from functools import wraps
from typing import Any

import numpy as np
from numpy.typing import NDArray

# ---------------------------------------------------------------------------
# Indicator cache — eliminates redundant computation when multiple strategies
# evaluate the same indicator on the same data within a single scan.
# Only active inside an `indicator_cache()` context manager.
# ---------------------------------------------------------------------------

_indicator_cache: dict[tuple[Any, ...], Any] = {}
_cache_active: bool = False


def cached_indicator(func: Callable[..., Any]) -> Callable[..., Any]:
    """Cache indicator results keyed on (function, array identity, params).

    Only caches when inside an ``indicator_cache()`` context. Direct calls
    outside that context always compute fresh results.
    """

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        if not _cache_active:
            return func(*args, **kwargs)
        key: tuple[Any, ...] = (
            (func.__name__,)
            + tuple(id(a) if isinstance(a, np.ndarray) else a for a in args)
            + tuple(sorted(kwargs.items()))
        )
        cached = _indicator_cache.get(key)
        if cached is not None:
            return cached
        result = func(*args, **kwargs)
        _indicator_cache[key] = result
        return result

    return wrapper


@contextmanager
def indicator_cache() -> Generator[None, None, None]:
    """Enable indicator caching for the duration of a scan.

    Within this context, repeated calls to the same indicator with the
    same array and parameters return cached results. The cache is cleared
    on exit and between ``clear_indicator_cache()`` calls.
    """
    global _cache_active  # noqa: PLW0603
    _cache_active = True
    try:
        yield
    finally:
        _indicator_cache.clear()
        _cache_active = False


def clear_indicator_cache() -> None:
    """Clear the indicator result cache. Call between tickers within a scan."""
    _indicator_cache.clear()


# ---------------------------------------------------------------------------
# Moving Averages
# ---------------------------------------------------------------------------


@cached_indicator
def sma(close: NDArray[np.float64], period: int) -> NDArray[np.float64]:
    """Simple Moving Average.

    Returns array of same length with NaN for indices < period - 1.
    """
    if period < 1:
        raise ValueError("period must be >= 1")
    out = np.full_like(close, np.nan, dtype=np.float64)
    if len(close) < period:
        return out
    cumsum = np.cumsum(close)
    out[period - 1 :] = (cumsum[period - 1 :] - np.concatenate([[0], cumsum[:-period]])) / period
    return out


@cached_indicator
def ema(close: NDArray[np.float64], period: int) -> NDArray[np.float64]:
    """Exponential Moving Average.

    Uses the standard multiplier: 2 / (period + 1).
    First value is seeded with the SMA of the first `period` values.
    """
    if period < 1:
        raise ValueError("period must be >= 1")
    out = np.full_like(close, np.nan, dtype=np.float64)
    if len(close) < period:
        return out
    multiplier = 2.0 / (period + 1)
    # Seed with SMA
    out[period - 1] = np.mean(close[:period])
    for i in range(period, len(close)):
        out[i] = (close[i] - out[i - 1]) * multiplier + out[i - 1]
    return out


def wma(close: NDArray[np.float64], period: int) -> NDArray[np.float64]:
    """Weighted Moving Average."""
    if period < 1:
        raise ValueError("period must be >= 1")
    out = np.full_like(close, np.nan, dtype=np.float64)
    if len(close) < period:
        return out
    weights = np.arange(1, period + 1, dtype=np.float64)
    weight_sum = weights.sum()
    # Vectorized via convolution (reversed weights for correlation mode)
    conv = np.convolve(close, weights[::-1], mode="valid")
    out[period - 1 :] = conv / weight_sum
    return out


# ---------------------------------------------------------------------------
# Oscillators
# ---------------------------------------------------------------------------


@cached_indicator
def rsi(close: NDArray[np.float64], period: int = 14) -> NDArray[np.float64]:
    """Relative Strength Index (Wilder's smoothing).

    Returns values in [0, 100]. NaN for indices < period.
    """
    if period < 1:
        raise ValueError("period must be >= 1")
    out = np.full_like(close, np.nan, dtype=np.float64)
    if len(close) < period + 1:
        return out

    deltas = np.diff(close)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    if avg_loss == 0:
        out[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        out[period] = 100.0 - (100.0 / (1.0 + rs))

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            out[i + 1] = 100.0
        else:
            rs = avg_gain / avg_loss
            out[i + 1] = 100.0 - (100.0 / (1.0 + rs))

    return out


def stochastic(
    high: NDArray[np.float64],
    low: NDArray[np.float64],
    close: NDArray[np.float64],
    k_period: int = 14,
    d_period: int = 3,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Stochastic Oscillator (%K and %D).

    Returns (percent_k, percent_d) arrays.
    """
    if k_period < 1 or d_period < 1:
        raise ValueError("periods must be >= 1")
    n = len(close)
    percent_k = np.full(n, np.nan, dtype=np.float64)

    if n >= k_period:
        # Vectorized rolling max/min via sliding_window_view
        from numpy.lib.stride_tricks import sliding_window_view

        h_windows = sliding_window_view(high, k_period)
        l_windows = sliding_window_view(low, k_period)
        highest = np.max(h_windows, axis=1)
        lowest = np.min(l_windows, axis=1)
        c = close[k_period - 1 :]
        denom = highest - lowest
        percent_k[k_period - 1 :] = np.where(denom == 0, 50.0, 100.0 * (c - lowest) / denom)

    percent_d = sma(percent_k, d_period)
    return percent_k, percent_d


# ---------------------------------------------------------------------------
# Trend Indicators
# ---------------------------------------------------------------------------


def macd(
    close: NDArray[np.float64],
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.float64]]:
    """MACD (Moving Average Convergence Divergence).

    Returns (macd_line, signal_line, histogram).
    """
    fast_ema = ema(close, fast)
    slow_ema = ema(close, slow)
    macd_line = fast_ema - slow_ema

    # Signal line: EMA of the MACD line (only where MACD is valid)
    valid_mask = ~np.isnan(macd_line)
    signal_line = np.full_like(close, np.nan, dtype=np.float64)
    if np.sum(valid_mask) >= signal_period:
        valid_macd = macd_line[valid_mask]
        sig = ema(valid_macd, signal_period)
        signal_line[valid_mask] = sig

    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


@cached_indicator
def adx(
    high: NDArray[np.float64],
    low: NDArray[np.float64],
    close: NDArray[np.float64],
    period: int = 14,
) -> NDArray[np.float64]:
    """Average Directional Index.

    Measures trend strength regardless of direction. Values > 25 indicate strong trend.
    """
    if period < 1:
        raise ValueError("period must be >= 1")
    n = len(close)
    out = np.full(n, np.nan, dtype=np.float64)
    if n < period + 1:
        return out

    tr = true_range(high, low, close)

    # Directional movement
    up_move = np.diff(high)
    down_move = -np.diff(low)

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    # Smoothed averages using Wilder's method
    atr_smooth = np.full(n, np.nan, dtype=np.float64)
    plus_di_smooth = np.full(n, np.nan, dtype=np.float64)
    minus_di_smooth = np.full(n, np.nan, dtype=np.float64)

    atr_smooth[period] = np.mean(tr[1 : period + 1])
    plus_di_smooth[period] = np.mean(plus_dm[:period])
    minus_di_smooth[period] = np.mean(minus_dm[:period])

    for i in range(period + 1, n):
        atr_smooth[i] = (atr_smooth[i - 1] * (period - 1) + tr[i]) / period
        plus_di_smooth[i] = (plus_di_smooth[i - 1] * (period - 1) + plus_dm[i - 1]) / period
        minus_di_smooth[i] = (minus_di_smooth[i - 1] * (period - 1) + minus_dm[i - 1]) / period

    # DI values — safe division to avoid NaN warnings
    with np.errstate(invalid="ignore", divide="ignore"):
        plus_di = np.where(atr_smooth > 0, 100.0 * plus_di_smooth / atr_smooth, 0.0)
        minus_di = np.where(atr_smooth > 0, 100.0 * minus_di_smooth / atr_smooth, 0.0)

        di_sum = plus_di + minus_di
        dx = np.where(di_sum > 0, 100.0 * np.abs(plus_di - minus_di) / di_sum, 0.0)

    # ADX = smoothed DX
    start = period * 2
    if start < n:
        out[start] = np.nanmean(dx[period : start + 1])
        for i in range(start + 1, n):
            out[i] = (out[i - 1] * (period - 1) + dx[i]) / period

    return out


# ---------------------------------------------------------------------------
# Volatility
# ---------------------------------------------------------------------------


@cached_indicator
def bollinger_bands(
    close: NDArray[np.float64],
    period: int = 20,
    num_std: float = 2.0,
) -> tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.float64]]:
    """Bollinger Bands.

    Returns (upper_band, middle_band, lower_band).
    """
    middle = sma(close, period)
    # Vectorized rolling population std via cumsum trick
    cumsum = np.cumsum(close)
    cumsum2 = np.cumsum(close**2)
    prefix = np.concatenate([[0], cumsum[:-period]])
    prefix2 = np.concatenate([[0], cumsum2[:-period]])
    window_sum = cumsum[period - 1 :] - prefix
    window_sum2 = cumsum2[period - 1 :] - prefix2
    variance = window_sum2 / period - (window_sum / period) ** 2
    # Clamp tiny negatives from floating-point arithmetic
    np.maximum(variance, 0.0, out=variance)
    std = np.full_like(close, np.nan, dtype=np.float64)
    std[period - 1 :] = np.sqrt(variance)
    upper = middle + num_std * std
    lower = middle - num_std * std
    return upper, middle, lower


def atr(
    high: NDArray[np.float64],
    low: NDArray[np.float64],
    close: NDArray[np.float64],
    period: int = 14,
) -> NDArray[np.float64]:
    """Average True Range (Wilder's smoothing).

    Measures volatility as an average of true ranges over `period` bars.
    """
    if period < 1:
        raise ValueError("period must be >= 1")
    tr = true_range(high, low, close)
    out = np.full_like(close, np.nan, dtype=np.float64)
    if len(close) < period + 1:
        return out

    out[period] = np.mean(tr[1 : period + 1])
    for i in range(period + 1, len(close)):
        out[i] = (out[i - 1] * (period - 1) + tr[i]) / period
    return out


def true_range(
    high: NDArray[np.float64],
    low: NDArray[np.float64],
    close: NDArray[np.float64],
) -> NDArray[np.float64]:
    """True Range — max of (H-L, |H-prev_C|, |L-prev_C|)."""
    n = len(close)
    tr = np.empty(n, dtype=np.float64)
    tr[0] = high[0] - low[0]
    if n > 1:
        hl = high[1:] - low[1:]
        hc = np.abs(high[1:] - close[:-1])
        lc = np.abs(low[1:] - close[:-1])
        tr[1:] = np.maximum(hl, np.maximum(hc, lc))
    return tr


def keltner_channels(
    high: NDArray[np.float64],
    low: NDArray[np.float64],
    close: NDArray[np.float64],
    ema_period: int = 20,
    atr_period: int = 10,
    multiplier: float = 1.5,
) -> tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.float64]]:
    """Keltner Channels (EMA ± multiplier * ATR).

    Returns (upper, middle, lower).
    """
    middle = ema(close, ema_period)
    atr_vals = atr(high, low, close, atr_period)
    upper = middle + multiplier * atr_vals
    lower = middle - multiplier * atr_vals
    return upper, middle, lower


# ---------------------------------------------------------------------------
# Volume Indicators
# ---------------------------------------------------------------------------


def vwap(
    high: NDArray[np.float64],
    low: NDArray[np.float64],
    close: NDArray[np.float64],
    volume: NDArray[np.float64],
) -> NDArray[np.float64]:
    """Volume Weighted Average Price (cumulative within session)."""
    typical_price = (high + low + close) / 3.0
    cum_tp_vol = np.cumsum(typical_price * volume)
    cum_vol = np.cumsum(volume)
    return np.where(cum_vol > 0, cum_tp_vol / cum_vol, np.nan)


def obv(
    close: NDArray[np.float64],
    volume: NDArray[np.float64],
) -> NDArray[np.float64]:
    """On Balance Volume."""
    n = len(close)
    if n == 0:
        return np.array([], dtype=np.float64)
    direction = np.sign(np.diff(close))
    signed_vol = np.empty(n, dtype=np.float64)
    signed_vol[0] = volume[0]
    signed_vol[1:] = direction * volume[1:]
    return np.cumsum(signed_vol)


def money_flow_index(
    high: NDArray[np.float64],
    low: NDArray[np.float64],
    close: NDArray[np.float64],
    volume: NDArray[np.float64],
    period: int = 14,
) -> NDArray[np.float64]:
    """Money Flow Index — volume-weighted RSI."""
    if period < 1:
        raise ValueError("period must be >= 1")
    n = len(close)
    out = np.full(n, np.nan, dtype=np.float64)
    if n < period + 1:
        return out

    typical = (high + low + close) / 3.0
    raw_mf = typical * volume

    # Classify each bar's flow direction (bar 0 has no predecessor, skip)
    tp_diff = np.diff(typical)
    pos_mf = np.zeros(n, dtype=np.float64)
    neg_mf = np.zeros(n, dtype=np.float64)
    pos_mf[1:] = np.where(tp_diff > 0, raw_mf[1:], 0.0)
    neg_mf[1:] = np.where(tp_diff < 0, raw_mf[1:], 0.0)

    # Rolling sums via cumsum difference
    cum_pos = np.cumsum(pos_mf)
    cum_neg = np.cumsum(neg_mf)
    pos_flow = cum_pos[period:] - cum_pos[: n - period]
    neg_flow = cum_neg[period:] - cum_neg[: n - period]

    with np.errstate(invalid="ignore", divide="ignore"):
        mf_ratio = np.where(neg_flow == 0, np.inf, pos_flow / neg_flow)
        out[period:] = np.where(neg_flow == 0, 100.0, 100.0 - (100.0 / (1.0 + mf_ratio)))

    return out


# ---------------------------------------------------------------------------
# Momentum
# ---------------------------------------------------------------------------


def rate_of_change(close: NDArray[np.float64], period: int = 10) -> NDArray[np.float64]:
    """Rate of Change (percentage)."""
    if period < 1:
        raise ValueError("period must be >= 1")
    out = np.full_like(close, np.nan, dtype=np.float64)
    if len(close) <= period:
        return out
    out[period:] = ((close[period:] - close[:-period]) / close[:-period]) * 100.0
    return out


def williams_r(
    high: NDArray[np.float64],
    low: NDArray[np.float64],
    close: NDArray[np.float64],
    period: int = 14,
) -> NDArray[np.float64]:
    """Williams %R oscillator. Range: [-100, 0]."""
    if period < 1:
        raise ValueError("period must be >= 1")
    n = len(close)
    out = np.full(n, np.nan, dtype=np.float64)
    if n >= period:
        from numpy.lib.stride_tricks import sliding_window_view

        h_windows = sliding_window_view(high, period)
        l_windows = sliding_window_view(low, period)
        hh = np.max(h_windows, axis=1)
        ll = np.min(l_windows, axis=1)
        c = close[period - 1 :]
        denom = hh - ll
        out[period - 1 :] = np.where(denom == 0, -50.0, -100.0 * (hh - c) / denom)
    return out
