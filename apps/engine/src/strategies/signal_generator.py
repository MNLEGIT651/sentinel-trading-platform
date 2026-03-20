"""Signal generation engine.

Orchestrates strategy execution across multiple instruments,
aggregates signals, and applies filtering/ranking logic.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy
from src.strategies.indicators import clear_indicator_cache, indicator_cache
from src.strategies.registry import create_composite, create_strategy

logger = logging.getLogger(__name__)


@dataclass
class SignalBatch:
    """Collection of signals from a single scan run."""

    signals: list[Signal] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    tickers_scanned: int = 0
    strategies_run: int = 0

    @property
    def total_signals(self) -> int:
        return len(self.signals)

    @property
    def long_signals(self) -> list[Signal]:
        return [s for s in self.signals if s.direction == SignalDirection.LONG]

    @property
    def short_signals(self) -> list[Signal]:
        return [s for s in self.signals if s.direction == SignalDirection.SHORT]

    def top_signals(self, n: int = 10) -> list[Signal]:
        """Return the top N signals sorted by strength (descending)."""
        return sorted(self.signals, key=lambda s: s.strength, reverse=True)[:n]


class SignalGenerator:
    """Orchestrates signal generation across strategies and instruments.

    Runs configured strategies against OHLCV data for multiple tickers
    and collects all generated signals.
    """

    def __init__(
        self,
        strategies: list[Strategy] | None = None,
        min_signal_strength: float = 0.1,
        max_signals_per_ticker: int = 5,
    ) -> None:
        """Initialize the signal generator.

        Args:
            strategies: List of strategies to run. If None, uses default set.
            min_signal_strength: Minimum strength threshold for signals.
            max_signals_per_ticker: Max signals per instrument to prevent noise.
        """
        self.strategies = strategies or self._default_strategies()
        self.min_signal_strength = min_signal_strength
        self.max_signals_per_ticker = max_signals_per_ticker

    @staticmethod
    def _default_strategies() -> list[Strategy]:
        """Create the default strategy set (one from each family)."""
        return [
            create_strategy("sma_crossover"),
            create_strategy("rsi_momentum"),
            create_strategy("bollinger_reversion"),
            create_strategy("price_to_ma_value"),
        ]

    def scan(self, data_map: dict[str, OHLCVData]) -> SignalBatch:
        """Run all strategies against all tickers.

        Args:
            data_map: Dict mapping ticker → OHLCVData.

        Returns:
            SignalBatch with all generated signals.
        """
        batch = SignalBatch()
        batch.tickers_scanned = len(data_map)

        with indicator_cache():
            for ticker, data in data_map.items():
                clear_indicator_cache()
                ticker_signals: list[Signal] = []

                for strategy in self.strategies:
                    batch.strategies_run += 1
                    try:
                        signals = strategy.generate_signals(data)
                        # Filter by minimum strength
                        filtered = [s for s in signals if s.strength >= self.min_signal_strength]
                        ticker_signals.extend(filtered)
                    except Exception as e:
                        error_msg = f"{strategy.name} failed on {ticker}: {e}"
                        logger.warning(error_msg)
                        batch.errors.append(error_msg)

                # Limit signals per ticker (keep strongest)
                ticker_signals.sort(key=lambda s: s.strength, reverse=True)
                batch.signals.extend(ticker_signals[: self.max_signals_per_ticker])

        return batch

    def scan_with_composite(
        self,
        data_map: dict[str, OHLCVData],
        strategy_weights: dict[str, float] | None = None,
    ) -> SignalBatch:
        """Run composite strategy (ensemble) against all tickers.

        Args:
            data_map: Dict mapping ticker → OHLCVData.
            strategy_weights: Optional custom weights for sub-strategies.

        Returns:
            SignalBatch with consensus signals from the composite.
        """
        composite = create_composite(strategy_weights=strategy_weights)
        batch = SignalBatch()
        batch.tickers_scanned = len(data_map)

        with indicator_cache():
            for ticker, data in data_map.items():
                clear_indicator_cache()
                batch.strategies_run += 1
                try:
                    signals = composite.generate_signals(data)
                    filtered = [s for s in signals if s.strength >= self.min_signal_strength]
                    batch.signals.extend(filtered)
                except Exception as e:
                    error_msg = f"Composite failed on {ticker}: {e}"
                    logger.warning(error_msg)
                    batch.errors.append(error_msg)

        return batch
