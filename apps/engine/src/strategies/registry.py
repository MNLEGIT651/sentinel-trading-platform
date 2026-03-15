"""Strategy registry — central index of all available strategies.

Provides factory methods to create strategy instances and discover
available strategy families.
"""

from __future__ import annotations

from typing import Any

from src.strategies.base import Strategy
from src.strategies.composite import CompositeStrategy
from src.strategies.mean_reversion import (
    BollingerReversion,
    RSIMeanReversion,
    ZScoreReversion,
)
from src.strategies.momentum import (
    OBVDivergence,
    RateOfChangeMomentum,
    RSIMomentum,
)
from src.strategies.pairs_trading import PairsSpreadTrading
from src.strategies.trend_following import (
    EMAMomentumTrend,
    MACDTrend,
    SMACrossover,
)
from src.strategies.value import PriceToMAValue, RelativeValue

# Master registry: name → class
STRATEGY_CLASSES: dict[str, type[Strategy]] = {
    # Trend Following
    "sma_crossover": SMACrossover,
    "ema_momentum_trend": EMAMomentumTrend,
    "macd_trend": MACDTrend,
    # Momentum
    "rsi_momentum": RSIMomentum,
    "roc_momentum": RateOfChangeMomentum,
    "obv_divergence": OBVDivergence,
    # Mean Reversion
    "bollinger_reversion": BollingerReversion,
    "zscore_reversion": ZScoreReversion,
    "rsi_mean_reversion": RSIMeanReversion,
    # Value
    "price_to_ma_value": PriceToMAValue,
    "relative_value": RelativeValue,
    # Pairs
    "pairs_spread": PairsSpreadTrading,
}

FAMILY_MAP: dict[str, list[str]] = {
    "trend_following": ["sma_crossover", "ema_momentum_trend", "macd_trend"],
    "momentum": ["rsi_momentum", "roc_momentum", "obv_divergence"],
    "mean_reversion": ["bollinger_reversion", "zscore_reversion", "rsi_mean_reversion"],
    "value": ["price_to_ma_value", "relative_value"],
    "pairs": ["pairs_spread"],
    "composite": [],  # Built dynamically from other strategies
}


def create_strategy(name: str, params: dict[str, Any] | None = None) -> Strategy:
    """Create a strategy instance by name.

    Args:
        name: Strategy name (must be in STRATEGY_CLASSES).
        params: Optional parameter overrides.

    Returns:
        Configured Strategy instance.

    Raises:
        KeyError: If strategy name is not registered.
    """
    if name not in STRATEGY_CLASSES:
        raise KeyError(f"Unknown strategy '{name}'. Available: {sorted(STRATEGY_CLASSES.keys())}")
    return STRATEGY_CLASSES[name](params=params)


def create_family(family: str, params: dict[str, Any] | None = None) -> list[Strategy]:
    """Create all strategies in a family.

    Args:
        family: Family name (e.g., 'trend_following', 'momentum').
        params: Optional shared parameter overrides.

    Returns:
        List of configured Strategy instances.

    Raises:
        KeyError: If family name is not registered.
    """
    if family not in FAMILY_MAP:
        raise KeyError(f"Unknown family '{family}'. Available: {sorted(FAMILY_MAP.keys())}")
    return [create_strategy(name, params) for name in FAMILY_MAP[family]]


def create_composite(
    strategy_weights: dict[str, float] | None = None,
    params: dict[str, Any] | None = None,
) -> CompositeStrategy:
    """Create a composite strategy from weighted sub-strategies.

    If no weights provided, uses equal-weight across all non-pairs strategies.
    """
    if strategy_weights is None:
        # Default: equal weight all single-instrument strategies
        exclude = {"pairs_spread"}
        names = [n for n in STRATEGY_CLASSES if n not in exclude]
        strategy_weights = {n: 1.0 for n in names}

    strategies = [(create_strategy(name), weight) for name, weight in strategy_weights.items()]
    return CompositeStrategy(strategies=strategies, params=params)


def list_strategies() -> dict[str, dict[str, Any]]:
    """List all registered strategies with their metadata.

    Returns:
        Dict mapping strategy name to info dict with description and family.
    """
    name_to_family = {}
    for family, names in FAMILY_MAP.items():
        for name in names:
            name_to_family[name] = family

    result = {}
    for name, cls in STRATEGY_CLASSES.items():
        instance = cls()
        result[name] = {
            "name": name,
            "family": name_to_family.get(name, "other"),
            "description": instance.description,
            "default_params": instance.params,
        }
    return result
