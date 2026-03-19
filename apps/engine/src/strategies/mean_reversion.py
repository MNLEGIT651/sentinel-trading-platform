"""Mean Reversion strategy family.

Strategies based on the statistical tendency of prices to revert
to their mean. Uses Bollinger Bands, RSI extremes, and z-scores.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy
from src.strategies.indicators import bollinger_bands, rsi


class BollingerReversion(Strategy):
    """Bollinger Band mean reversion strategy.

    Enters long when price touches or crosses below lower band,
    enters short when price touches or crosses above upper band.
    RSI confirmation prevents catching falling knives.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "bb_period": 20,
        "bb_std": 2.0,
        "rsi_period": 14,
        "rsi_oversold": 35.0,
        "rsi_overbought": 65.0,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="bollinger_reversion",
            description="Bollinger Band reversion with RSI confirmation",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = max(self.params["bb_period"], self.params["rsi_period"]) + 5
        if not self.validate_data(data, min_bars):
            return []

        upper, middle, lower = bollinger_bands(
            data.close, self.params["bb_period"], self.params["bb_std"]
        )
        rsi_vals = rsi(data.close, self.params["rsi_period"])

        i = len(data) - 1
        if any(np.isnan(x) for x in [upper[i], lower[i], rsi_vals[i]]):
            return []

        signals: list[Signal] = []
        price = data.close[i]
        current_rsi = rsi_vals[i]
        band_width = upper[i] - lower[i]

        # Long: price at or below lower band + RSI confirms oversold
        if price <= lower[i] and current_rsi <= self.params["rsi_oversold"]:
            # Strength based on how far below lower band
            penetration = (lower[i] - price) / band_width if band_width > 0 else 0
            strength = min(0.4 + penetration * 3, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Price below lower BB "
                        f"(${price:.2f} < ${lower[i]:.2f}), "
                        f"RSI={current_rsi:.1f}"
                    ),
                    metadata={
                        "price": price,
                        "lower_band": lower[i],
                        "upper_band": upper[i],
                        "middle_band": middle[i],
                        "rsi": current_rsi,
                    },
                )
            )

        # Short: price at or above upper band + RSI confirms overbought
        elif price >= upper[i] and current_rsi >= self.params["rsi_overbought"]:
            penetration = (price - upper[i]) / band_width if band_width > 0 else 0
            strength = min(0.4 + penetration * 3, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Price above upper BB "
                        f"(${price:.2f} > ${upper[i]:.2f}), "
                        f"RSI={current_rsi:.1f}"
                    ),
                    metadata={
                        "price": price,
                        "lower_band": lower[i],
                        "upper_band": upper[i],
                        "middle_band": middle[i],
                        "rsi": current_rsi,
                    },
                )
            )

        return signals


class ZScoreReversion(Strategy):
    """Z-Score mean reversion strategy.

    Uses statistical z-score to identify extreme deviations from the mean.
    Enters positions when z-score exceeds threshold, expecting reversion.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "lookback": 50,
        "entry_z": 2.0,
        "exit_z": 0.5,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="zscore_reversion",
            description="Statistical z-score mean reversion",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        lookback = self.params["lookback"]
        if not self.validate_data(data, lookback + 5):
            return []

        i = len(data) - 1
        window = data.close[i - lookback + 1 : i + 1]
        mean = np.mean(window)
        std = np.std(window, ddof=1)

        if std == 0:
            return []

        z = (data.close[i] - mean) / std
        signals: list[Signal] = []

        if z < -self.params["entry_z"]:
            strength = min(abs(z) / 4.0, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=strength,
                    strategy_name=self.name,
                    reason=f"Extreme low z-score: {z:.2f} (mean=${mean:.2f}, std=${std:.2f})",
                    metadata={"z_score": z, "mean": mean, "std": std},
                )
            )

        elif z > self.params["entry_z"]:
            strength = min(abs(z) / 4.0, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=strength,
                    strategy_name=self.name,
                    reason=f"Extreme high z-score: {z:.2f} (mean=${mean:.2f}, std=${std:.2f})",
                    metadata={"z_score": z, "mean": mean, "std": std},
                )
            )

        return signals


class RSIMeanReversion(Strategy):
    """RSI extreme-level mean reversion strategy.

    More aggressive than RSIMomentum — enters at extreme RSI levels
    anticipating a snapback. Uses multi-period RSI confirmation.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "fast_rsi_period": 7,
        "slow_rsi_period": 14,
        "extreme_oversold": 20.0,
        "extreme_overbought": 80.0,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="rsi_mean_reversion",
            description="Multi-period RSI extreme reversion",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = self.params["slow_rsi_period"] + 5
        if not self.validate_data(data, min_bars):
            return []

        fast_rsi = rsi(data.close, self.params["fast_rsi_period"])
        slow_rsi = rsi(data.close, self.params["slow_rsi_period"])

        i = len(data) - 1
        if np.isnan(fast_rsi[i]) or np.isnan(slow_rsi[i]):
            return []

        signals: list[Signal] = []

        # Both RSI periods in extreme oversold
        if (
            fast_rsi[i] < self.params["extreme_oversold"]
            and slow_rsi[i] < self.params["extreme_oversold"] + 10
        ):
            avg_rsi = (fast_rsi[i] + slow_rsi[i]) / 2
            strength = min((self.params["extreme_oversold"] - avg_rsi) / 20.0 + 0.4, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Double RSI extreme oversold "
                        f"(fast={fast_rsi[i]:.1f}, "
                        f"slow={slow_rsi[i]:.1f})"
                    ),
                    metadata={"fast_rsi": fast_rsi[i], "slow_rsi": slow_rsi[i]},
                )
            )

        # Both RSI periods in extreme overbought
        elif (
            fast_rsi[i] > self.params["extreme_overbought"]
            and slow_rsi[i] > self.params["extreme_overbought"] - 10
        ):
            avg_rsi = (fast_rsi[i] + slow_rsi[i]) / 2
            strength = min((avg_rsi - self.params["extreme_overbought"]) / 20.0 + 0.4, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Double RSI extreme overbought "
                        f"(fast={fast_rsi[i]:.1f}, "
                        f"slow={slow_rsi[i]:.1f})"
                    ),
                    metadata={"fast_rsi": fast_rsi[i], "slow_rsi": slow_rsi[i]},
                )
            )

        return signals
