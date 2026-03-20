"""Trend Following strategy family.

Strategies that identify and ride established market trends.
Uses moving average crossovers, MACD, and ADX for trend confirmation.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy
from src.strategies.indicators import adx, ema, macd, sma


class SMACrossover(Strategy):
    """Dual SMA crossover strategy.

    Goes long when fast SMA crosses above slow SMA (golden cross),
    goes short when fast SMA crosses below slow SMA (death cross).
    ADX is used as a trend strength filter.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "fast_period": 20,
        "slow_period": 50,
        "adx_period": 14,
        "adx_threshold": 20.0,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="sma_crossover",
            description="Dual SMA crossover with ADX trend filter",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = self.params["slow_period"] + 5
        if not self.validate_data(data, min_bars):
            return []

        fast = sma(data.close, self.params["fast_period"])
        slow = sma(data.close, self.params["slow_period"])
        adx_vals = adx(data.high, data.low, data.close, self.params["adx_period"])

        # Check last two bars for crossover
        i = len(data) - 1
        if np.isnan(fast[i]) or np.isnan(slow[i]) or np.isnan(fast[i - 1]) or np.isnan(slow[i - 1]):
            return []

        curr_adx = adx_vals[i] if not np.isnan(adx_vals[i]) else 0.0
        if curr_adx < self.params["adx_threshold"]:
            return []

        signals: list[Signal] = []
        strength = min(curr_adx / 50.0, 1.0)

        # Golden cross: fast crosses above slow
        if fast[i - 1] <= slow[i - 1] and fast[i] > slow[i]:
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"SMA golden cross "
                        f"(fast={self.params['fast_period']}, "
                        f"slow={self.params['slow_period']}), "
                        f"ADX={curr_adx:.1f}"
                    ),
                    metadata={"fast_sma": fast[i], "slow_sma": slow[i], "adx": curr_adx},
                )
            )

        # Death cross: fast crosses below slow
        elif fast[i - 1] >= slow[i - 1] and fast[i] < slow[i]:
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"SMA death cross "
                        f"(fast={self.params['fast_period']}, "
                        f"slow={self.params['slow_period']}), "
                        f"ADX={curr_adx:.1f}"
                    ),
                    metadata={"fast_sma": fast[i], "slow_sma": slow[i], "adx": curr_adx},
                )
            )

        return signals


class EMAMomentumTrend(Strategy):
    """Triple EMA trend strategy.

    Uses 3 EMAs (fast, medium, slow) to confirm trend direction.
    All three must be aligned for a signal (fast > medium > slow for long).
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "fast_period": 8,
        "medium_period": 21,
        "slow_period": 55,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="ema_momentum_trend",
            description="Triple EMA trend alignment strategy",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = self.params["slow_period"] + 5
        if not self.validate_data(data, min_bars):
            return []

        fast = ema(data.close, self.params["fast_period"])
        medium = ema(data.close, self.params["medium_period"])
        slow = ema(data.close, self.params["slow_period"])

        i = len(data) - 1
        if any(np.isnan(x[j]) for x in [fast, medium, slow] for j in (i, i - 1)):
            return []

        signals: list[Signal] = []

        # Current and previous alignment state
        curr_bullish = fast[i] > medium[i] > slow[i]
        prev_bullish = fast[i - 1] > medium[i - 1] > slow[i - 1]
        curr_bearish = fast[i] < medium[i] < slow[i]
        prev_bearish = fast[i - 1] < medium[i - 1] < slow[i - 1]

        # Only signal on alignment onset (transition from unaligned to aligned)
        if curr_bullish and not prev_bullish:
            spread = (fast[i] - slow[i]) / slow[i]
            strength = min(spread * 20, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=max(strength, 0.1),
                    strategy_name=self.name,
                    reason=f"Triple EMA bullish alignment onset (spread={spread:.4f})",
                    metadata={"fast": fast[i], "medium": medium[i], "slow": slow[i]},
                )
            )

        elif curr_bearish and not prev_bearish:
            spread = (slow[i] - fast[i]) / slow[i]
            strength = min(spread * 20, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=max(strength, 0.1),
                    strategy_name=self.name,
                    reason=f"Triple EMA bearish alignment onset (spread={spread:.4f})",
                    metadata={"fast": fast[i], "medium": medium[i], "slow": slow[i]},
                )
            )

        return signals


class MACDTrend(Strategy):
    """MACD trend-following strategy.

    Signals on MACD line / signal line crossovers confirmed by
    MACD histogram direction change.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "fast": 12,
        "slow": 26,
        "signal_period": 9,
        "histogram_threshold": 0.0,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="macd_trend",
            description="MACD crossover trend strategy",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = self.params["slow"] + self.params["signal_period"] + 5
        if not self.validate_data(data, min_bars):
            return []

        macd_line, signal_line, histogram = macd(
            data.close,
            fast=self.params["fast"],
            slow=self.params["slow"],
            signal_period=self.params["signal_period"],
        )

        i = len(data) - 1
        if any(
            np.isnan(x)
            for x in [macd_line[i], signal_line[i], macd_line[i - 1], signal_line[i - 1]]
        ):
            return []

        signals: list[Signal] = []

        # Bullish crossover
        if macd_line[i - 1] <= signal_line[i - 1] and macd_line[i] > signal_line[i]:
            strength = min(abs(histogram[i]) / data.last_close * 100, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=max(strength, 0.1),
                    strategy_name=self.name,
                    reason=f"MACD bullish crossover (hist={histogram[i]:.4f})",
                    metadata={
                        "macd": macd_line[i],
                        "signal": signal_line[i],
                        "histogram": histogram[i],
                    },
                )
            )

        # Bearish crossover
        elif macd_line[i - 1] >= signal_line[i - 1] and macd_line[i] < signal_line[i]:
            strength = min(abs(histogram[i]) / data.last_close * 100, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=max(strength, 0.1),
                    strategy_name=self.name,
                    reason=f"MACD bearish crossover (hist={histogram[i]:.4f})",
                    metadata={
                        "macd": macd_line[i],
                        "signal": signal_line[i],
                        "histogram": histogram[i],
                    },
                )
            )

        return signals
