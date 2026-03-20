"""Composite strategy family.

Multi-strategy ensemble that aggregates signals from multiple strategies
and produces a weighted consensus signal. Implements the Layer A concept
from the trading blueprint: diversified return sources.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy


class CompositeStrategy(Strategy):
    """Weighted ensemble of multiple strategies.

    Collects signals from child strategies, groups by ticker and direction,
    then produces consensus signals based on weighted voting.

    The weight of each strategy can be configured. Strategies that agree
    reinforce the signal; conflicting signals cancel out.
    """

    DEFAULT_PARAMS: dict[str, Any] = {
        "min_agreement": 2,  # Minimum strategies that must agree
        "min_strength": 0.3,  # Minimum weighted strength to emit
        "conflict_penalty": 0.5,  # Penalty when strategies disagree
    }

    def __init__(
        self,
        strategies: list[tuple[Strategy, float]],
        params: dict[str, Any] | None = None,
    ) -> None:
        """Initialize composite strategy.

        Args:
            strategies: List of (strategy, weight) tuples.
            params: Override default parameters.
        """
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(
            name="composite",
            description="Weighted multi-strategy ensemble",
            params=merged,
        )
        self.strategies = strategies
        total_weight = sum(w for _, w in strategies)
        # Normalize weights
        self._normalized: list[tuple[Strategy, float]] = [
            (s, w / total_weight) for s, w in strategies
        ]

    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        """Aggregate signals from all child strategies."""
        all_signals: list[Signal] = []
        for strategy, _ in self.strategies:
            child_signals = strategy.generate_signals(data)
            all_signals.extend(child_signals)

        if not all_signals:
            return []

        return self._aggregate_signals(data.ticker, all_signals)

    def _aggregate_signals(self, ticker: str, signals: list[Signal]) -> list[Signal]:
        """Aggregate and weight signals from child strategies.

        Groups by direction, computes weighted consensus, applies
        conflict penalty if opposing signals exist.
        """
        # Map strategy names to their weights
        weight_map = {s.name: w for s, w in self._normalized}

        # Group signals by direction
        direction_groups: dict[SignalDirection, list[Signal]] = defaultdict(list)
        for sig in signals:
            direction_groups[sig.direction].append(sig)

        # Skip FLAT signals
        long_sigs = direction_groups.get(SignalDirection.LONG, [])
        short_sigs = direction_groups.get(SignalDirection.SHORT, [])

        result: list[Signal] = []

        # Calculate weighted strength for each direction
        fallback_weight = 1.0 / len(self._normalized) if self._normalized else 0.0
        long_strength = sum(
            s.strength * weight_map.get(s.strategy_name, fallback_weight) for s in long_sigs
        )
        short_strength = sum(
            s.strength * weight_map.get(s.strategy_name, fallback_weight) for s in short_sigs
        )

        # Apply conflict penalty
        if long_sigs and short_sigs:
            penalty = self.params["conflict_penalty"]
            long_strength *= penalty
            short_strength *= penalty

        min_agreement = self.params["min_agreement"]
        min_strength = self.params["min_strength"]

        # Emit long signal if consensus
        if (
            len(long_sigs) >= min_agreement
            and long_strength >= min_strength
            and long_strength > short_strength
        ):
            contributing = [s.strategy_name for s in long_sigs]
            result.append(
                Signal(
                    ticker=ticker,
                    direction=SignalDirection.LONG,
                    strength=min(long_strength, 1.0),
                    strategy_name=self.name,
                    reason=(
                        f"Composite LONG consensus: {len(long_sigs)} "
                        f"strategies agree ({', '.join(contributing)})"
                    ),
                    metadata={
                        "contributing_strategies": contributing,
                        "long_strength": long_strength,
                        "short_strength": short_strength,
                        "signal_count": len(long_sigs),
                    },
                )
            )

        # Emit short signal if consensus
        elif (
            len(short_sigs) >= min_agreement
            and short_strength >= min_strength
            and short_strength > long_strength
        ):
            contributing = [s.strategy_name for s in short_sigs]
            result.append(
                Signal(
                    ticker=ticker,
                    direction=SignalDirection.SHORT,
                    strength=min(short_strength, 1.0),
                    strategy_name=self.name,
                    reason=(
                        f"Composite SHORT consensus: {len(short_sigs)} "
                        f"strategies agree ({', '.join(contributing)})"
                    ),
                    metadata={
                        "contributing_strategies": contributing,
                        "long_strength": long_strength,
                        "short_strength": short_strength,
                        "signal_count": len(short_sigs),
                    },
                )
            )

        return result
