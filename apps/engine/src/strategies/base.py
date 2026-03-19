"""Abstract base classes for trading strategies."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

import numpy as np
from numpy.typing import NDArray


class SignalDirection(StrEnum):
    """Signal direction enum."""

    LONG = "long"
    SHORT = "short"
    FLAT = "flat"


@dataclass(frozen=True)
class Signal:
    """A trading signal emitted by a strategy."""

    ticker: str
    direction: SignalDirection
    strength: float  # 0.0 to 1.0
    strategy_name: str
    reason: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not 0.0 <= self.strength <= 1.0:
            raise ValueError(f"strength must be in [0, 1], got {self.strength}")


@dataclass
class OHLCVData:
    """OHLCV market data for a single instrument."""

    ticker: str
    timestamps: NDArray[np.float64]
    open: NDArray[np.float64]
    high: NDArray[np.float64]
    low: NDArray[np.float64]
    close: NDArray[np.float64]
    volume: NDArray[np.float64]

    def __len__(self) -> int:
        return len(self.close)

    @property
    def last_close(self) -> float:
        return float(self.close[-1])

    @property
    def last_volume(self) -> float:
        return float(self.volume[-1])


class Strategy(ABC):
    """Abstract base class for all trading strategies.

    Subclasses implement `generate_signals()` to analyze OHLCV data
    and produce zero or more Signal objects.
    """

    def __init__(self, name: str, description: str, params: dict[str, Any] | None = None) -> None:
        self.name = name
        self.description = description
        self.params: dict[str, Any] = params or {}

    @abstractmethod
    def generate_signals(self, data: OHLCVData) -> list[Signal]:
        """Analyze market data and generate trading signals.

        Args:
            data: OHLCV data for a single instrument.

        Returns:
            List of Signal objects (may be empty if no signal conditions met).
        """

    def validate_data(self, data: OHLCVData, min_bars: int) -> bool:
        """Check that the data has enough bars for this strategy."""
        return len(data) >= min_bars

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name!r})"
