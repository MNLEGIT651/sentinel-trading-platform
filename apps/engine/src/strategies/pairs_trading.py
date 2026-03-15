"""Pairs Trading strategy family.

Statistical arbitrage strategies that exploit mean-reverting relationships
between correlated instruments. Uses spread z-scores and correlation analysis.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray

from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy


def compute_spread(
    series_a: NDArray[np.float64],
    series_b: NDArray[np.float64],
) -> tuple[NDArray[np.float64], float, float]:
    """Compute the log-price spread and hedge ratio via OLS regression.

    Returns (spread, beta, intercept).
    """
    log_a = np.log(series_a)
    log_b = np.log(series_b)

    # OLS: log_a = beta * log_b + intercept + epsilon
    n = len(log_a)
    x_mean = np.mean(log_b)
    y_mean = np.mean(log_a)
    ss_xy = np.sum((log_b - x_mean) * (log_a - y_mean))
    ss_xx = np.sum((log_b - x_mean) ** 2)

    if ss_xx == 0:
        return np.zeros(n), 1.0, 0.0

    beta = ss_xy / ss_xx
    intercept = y_mean - beta * x_mean
    spread = log_a - beta * log_b - intercept
    return spread, float(beta), float(intercept)


def rolling_correlation(
    series_a: NDArray[np.float64],
    series_b: NDArray[np.float64],
    window: int,
) -> NDArray[np.float64]:
    """Compute rolling Pearson correlation between two series."""
    n = len(series_a)
    corr = np.full(n, np.nan, dtype=np.float64)

    for i in range(window - 1, n):
        a = series_a[i - window + 1 : i + 1]
        b = series_b[i - window + 1 : i + 1]
        std_a = np.std(a, ddof=1)
        std_b = np.std(b, ddof=1)
        if std_a == 0 or std_b == 0:
            corr[i] = 0.0
        else:
            corr[i] = np.corrcoef(a, b)[0, 1]

    return corr


class PairsSpreadTrading(Strategy):
    """Pairs trading using spread z-score.

    Requires data from TWO instruments. The strategy computes the
    log-price spread, normalizes it as a z-score, and trades
    when the spread diverges significantly from equilibrium.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "lookback": 60,
        "entry_z": 2.0,
        "exit_z": 0.5,
        "min_correlation": 0.7,
        "correlation_window": 30,
    }

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="pairs_spread",
            description="Statistical pairs trading via spread z-score",
            params=merged,
        )

    def generate_pair_signals(
        self,
        data_a: OHLCVData,
        data_b: OHLCVData,
    ) -> list[Signal]:
        """Generate signals for a pair of instruments.

        Args:
            data_a: OHLCV data for instrument A (the 'dependent' variable).
            data_b: OHLCV data for instrument B (the 'independent' variable).

        Returns:
            Signals for instrument A. For the corresponding trade in B,
            take the opposite direction scaled by the hedge ratio.
        """
        lookback = self.params["lookback"]
        min_len = max(lookback, self.params["correlation_window"]) + 5

        if len(data_a) < min_len or len(data_b) < min_len:
            return []

        # Ensure same length
        n = min(len(data_a), len(data_b))
        close_a = data_a.close[-n:]
        close_b = data_b.close[-n:]

        # Check correlation
        corr = rolling_correlation(close_a, close_b, self.params["correlation_window"])
        if np.isnan(corr[-1]) or abs(corr[-1]) < self.params["min_correlation"]:
            return []

        # Compute spread on recent window
        spread, beta, intercept = compute_spread(close_a[-lookback:], close_b[-lookback:])
        spread_mean = np.mean(spread)
        spread_std = np.std(spread, ddof=1)

        if spread_std == 0:
            return []

        z = (spread[-1] - spread_mean) / spread_std
        signals: list[Signal] = []

        # Spread too high: short A, long B (spread will revert down)
        if z > self.params["entry_z"]:
            strength = min(abs(z) / 4.0, 1.0)
            signals.append(
                Signal(
                    ticker=data_a.ticker,
                    direction=SignalDirection.SHORT,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Pairs spread high: z={z:.2f}, "
                        f"{data_a.ticker}/{data_b.ticker} "
                        f"(β={beta:.3f}, corr={corr[-1]:.2f})"
                    ),
                    metadata={
                        "pair": f"{data_a.ticker}/{data_b.ticker}",
                        "z_score": z,
                        "beta": beta,
                        "correlation": corr[-1],
                        "spread_mean": spread_mean,
                        "spread_std": spread_std,
                    },
                )
            )

        # Spread too low: long A, short B (spread will revert up)
        elif z < -self.params["entry_z"]:
            strength = min(abs(z) / 4.0, 1.0)
            signals.append(
                Signal(
                    ticker=data_a.ticker,
                    direction=SignalDirection.LONG,
                    strength=strength,
                    strategy_name=self.name,
                    reason=(
                        f"Pairs spread low: z={z:.2f}, "
                        f"{data_a.ticker}/{data_b.ticker} "
                        f"(β={beta:.3f}, corr={corr[-1]:.2f})"
                    ),
                    metadata={
                        "pair": f"{data_a.ticker}/{data_b.ticker}",
                        "z_score": z,
                        "beta": beta,
                        "correlation": corr[-1],
                        "spread_mean": spread_mean,
                        "spread_std": spread_std,
                    },
                )
            )

        return signals

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        """Single-instrument interface — not applicable for pairs.

        Use generate_pair_signals() instead. Returns empty list.
        """
        return []
