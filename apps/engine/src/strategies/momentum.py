"""Momentum strategy family.

Strategies based on the persistence of price trends and relative strength.
Uses RSI, Rate of Change, and volume-price analysis.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy
from src.strategies.indicators import obv, rate_of_change, rsi, sma


class RSIMomentum(Strategy):
    """RSI-based momentum strategy.

    Enters long positions when RSI rebounds from oversold with momentum.
    Enters short positions when RSI reverses from overbought.
    Avoids extreme levels where reversal risk is highest.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "rsi_period": 14,
        "oversold": 30.0,
        "overbought": 70.0,
        "momentum_zone_low": 40.0,
        "momentum_zone_high": 60.0,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="rsi_momentum",
            description="RSI momentum with zone-based entry",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = self.params["rsi_period"] + 5
        if not self.validate_data(data, min_bars):
            return []

        rsi_vals = rsi(data.close, self.params["rsi_period"])
        i = len(data) - 1

        if np.isnan(rsi_vals[i]) or np.isnan(rsi_vals[i - 1]) or np.isnan(rsi_vals[i - 2]):
            return []

        signals: list[Signal] = []
        current_rsi = rsi_vals[i]
        prev_rsi = rsi_vals[i - 1]
        prev2_rsi = rsi_vals[i - 2]

        # Bullish: RSI was oversold and is now rising through momentum zone
        if (
            prev2_rsi < self.params["oversold"]
            and prev_rsi >= self.params["oversold"]
            and current_rsi > prev_rsi
        ):
            strength = min((self.params["oversold"] - prev2_rsi) / 30.0 + 0.3, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=strength,
                    strategy_name=self.name,
                    reason=f"RSI oversold recovery ({prev2_rsi:.1f} → {current_rsi:.1f})",
                    metadata={"rsi": current_rsi, "prev_rsi": prev2_rsi},
                )
            )

        # Bearish: RSI was overbought and is now falling
        elif (
            prev2_rsi > self.params["overbought"]
            and prev_rsi <= self.params["overbought"]
            and current_rsi < prev_rsi
        ):
            strength = min((prev2_rsi - self.params["overbought"]) / 30.0 + 0.3, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=strength,
                    strategy_name=self.name,
                    reason=f"RSI overbought reversal ({prev2_rsi:.1f} → {current_rsi:.1f})",
                    metadata={"rsi": current_rsi, "prev_rsi": prev2_rsi},
                )
            )

        return signals


class RateOfChangeMomentum(Strategy):
    """Rate of Change (ROC) momentum strategy.

    Identifies strong price momentum by measuring percentage change
    over a lookback period. Combined with volume confirmation.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "roc_period": 10,
        "threshold": 3.0,  # Minimum ROC% to trigger signal
        "volume_sma_period": 20,
        "volume_multiplier": 1.5,  # Volume must be N× above average
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="roc_momentum",
            description="Rate of Change momentum with volume confirmation",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = max(self.params["roc_period"], self.params["volume_sma_period"]) + 5
        if not self.validate_data(data, min_bars):
            return []

        roc_vals = rate_of_change(data.close, self.params["roc_period"])
        vol_sma = sma(data.volume, self.params["volume_sma_period"])

        i = len(data) - 1
        if np.isnan(roc_vals[i]) or np.isnan(vol_sma[i]):
            return []

        signals: list[Signal] = []
        current_roc = roc_vals[i]
        volume_ratio = data.volume[i] / vol_sma[i] if vol_sma[i] > 0 else 0

        # Volume confirmation required
        if volume_ratio < self.params["volume_multiplier"]:
            return []

        threshold = self.params["threshold"]

        if current_roc > threshold:
            strength = min(current_roc / (threshold * 3), 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Strong upward momentum: "
                        f"ROC={current_roc:.2f}%, "
                        f"vol={volume_ratio:.1f}×avg"
                    ),
                    metadata={"roc": current_roc, "volume_ratio": volume_ratio},
                )
            )
        elif current_roc < -threshold:
            strength = min(abs(current_roc) / (threshold * 3), 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Strong downward momentum: "
                        f"ROC={current_roc:.2f}%, "
                        f"vol={volume_ratio:.1f}×avg"
                    ),
                    metadata={"roc": current_roc, "volume_ratio": volume_ratio},
                )
            )

        return signals


class OBVDivergence(Strategy):
    """On Balance Volume divergence strategy.

    Detects divergence between price and OBV trends to anticipate reversals.
    Price making new highs with declining OBV = bearish divergence.
    Price making new lows with rising OBV = bullish divergence.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "lookback": 20,
        "obv_sma_period": 10,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="obv_divergence",
            description="OBV price divergence strategy",
            params=merged,
        )

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        min_bars = self.params["lookback"] + self.params["obv_sma_period"] + 5
        if not self.validate_data(data, min_bars):
            return []

        obv_vals = obv(data.close, data.volume)
        obv_ma = sma(obv_vals, self.params["obv_sma_period"])
        lookback = self.params["lookback"]

        i = len(data) - 1
        if np.isnan(obv_ma[i]):
            return []

        signals: list[Signal] = []

        # Check price and OBV trends over lookback
        price_window = data.close[i - lookback : i + 1]
        obv_window = obv_vals[i - lookback : i + 1]

        price_higher_high = price_window[-1] > np.max(price_window[:-1])
        price_lower_low = price_window[-1] < np.min(price_window[:-1])
        obv_declining = obv_window[-1] < obv_window[0]
        obv_rising = obv_window[-1] > obv_window[0]

        # Bearish divergence: price at high but OBV declining
        if price_higher_high and obv_declining:
            obv_drop = (
                (obv_window[0] - obv_window[-1]) / abs(obv_window[0]) if obv_window[0] != 0 else 0
            )
            strength = min(abs(obv_drop) * 5, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.SHORT,
                    strength=max(strength, 0.2),
                    strategy_name=self.name,
                    reason="Bearish OBV divergence: price at high but volume declining",
                    metadata={"obv_change": obv_drop, "price": data.last_close},
                )
            )

        # Bullish divergence: price at low but OBV rising
        elif price_lower_low and obv_rising:
            obv_rise = (
                (obv_window[-1] - obv_window[0]) / abs(obv_window[0]) if obv_window[0] != 0 else 0
            )
            strength = min(abs(obv_rise) * 5, 1.0)
            signals.append(
                Signal(
                    ticker=data.ticker,
                    direction=SignalDirection.LONG,
                    strength=max(strength, 0.2),
                    strategy_name=self.name,
                    reason="Bullish OBV divergence: price at low but volume rising",
                    metadata={"obv_change": obv_rise, "price": data.last_close},
                )
            )

        return signals
