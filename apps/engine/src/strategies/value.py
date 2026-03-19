"""Value strategy family.

Strategies based on price deviation from estimated fair value.
Uses relative value metrics and price-to-moving-average ratios.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy
from src.strategies.indicators import ema, sma


class PriceToMAValue(Strategy):
    """Price-to-Moving-Average value strategy.

    Identifies value opportunities by measuring price deviation from
    long-term moving averages. Significant deviations suggest mispricing.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "ma_period": 200,
        "entry_deviation": -0.10,  # 10% below MA = long
        "exit_deviation": 0.0,
        "max_long_deviation": -0.25,  # Avoid > 25% drops (distressed)
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="price_to_ma_value",
            description="Price-to-MA deviation value strategy",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = self.params["ma_period"] + 10
        if not self.validate_data(data, min_bars):
            return []

        ma = sma(data.close, self.params["ma_period"])
        i = len(data) - 1

        if np.isnan(ma[i]):
            return []

        deviation = (data.close[i] - ma[i]) / ma[i]
        signals: list[Signal] = []

        # Value long: price significantly below long-term MA
        if self.params["max_long_deviation"] <= deviation <= self.params["entry_deviation"]:
            strength = min(abs(deviation) / 0.20, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Price {deviation:.1%} below "
                        f"{self.params['ma_period']}-day MA "
                        f"(${ma[i]:.2f})"
                    ),
                    metadata={"deviation": deviation, "ma": ma[i], "price": data.close[i]},
                )
            )

        # Overvalued: price significantly above long-term MA
        elif deviation > abs(self.params["entry_deviation"]):
            strength = min(deviation / 0.20, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Price {deviation:.1%} above "
                        f"{self.params['ma_period']}-day MA "
                        f"(${ma[i]:.2f})"
                    ),
                    metadata={"deviation": deviation, "ma": ma[i], "price": data.close[i]},
                )
            )

        return signals


class RelativeValue(Strategy):
    """Relative value strategy using dual timeframe analysis.

    Compares short-term and long-term value metrics to find
    instruments that are temporarily mispriced relative to their trend.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "short_period": 20,
        "long_period": 100,
        "divergence_threshold": 0.05,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="relative_value",
            description="Dual-timeframe relative value strategy",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = self.params["long_period"] + 5
        if not self.validate_data(data, min_bars):
            return []

        short_ma = ema(data.close, self.params["short_period"])
        long_ma = sma(data.close, self.params["long_period"])

        i = len(data) - 1
        if np.isnan(short_ma[i]) or np.isnan(long_ma[i]):
            return []

        # Short-term deviation from long-term
        short_dev = (data.close[i] - short_ma[i]) / short_ma[i]
        long_dev = (data.close[i] - long_ma[i]) / long_ma[i]

        # Divergence: short-term says cheap but long-term trend intact
        divergence = long_dev - short_dev
        signals: list[Signal] = []
        threshold = self.params["divergence_threshold"]

        if divergence > threshold and short_dev < 0:
            # Price dipped below short MA but above long MA = buying opportunity
            strength = min(abs(divergence) / (threshold * 3), 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=max(strength, 0.2),
                    strategy_name=self.name,
                    reason=f"Relative value long: short-term dip in uptrend (div={divergence:.3f})",
                    metadata={
                        "short_dev": short_dev,
                        "long_dev": long_dev,
                        "divergence": divergence,
                    },
                )
            )

        elif divergence < -threshold and short_dev > 0:
            # Price spiked above short MA but below long MA = selling opportunity
            strength = min(abs(divergence) / (threshold * 3), 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=max(strength, 0.2),
                    strategy_name=self.name,
                    reason=(
                        f"Relative value short: short-term spike "
                        f"in downtrend (div={divergence:.3f})"
                    ),
                    metadata={
                        "short_dev": short_dev,
                        "long_dev": long_dev,
                        "divergence": divergence,
                    },
                )
            )

        return signals
