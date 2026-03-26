"""Unit tests for strategy base classes.

Tests Signal, OHLCVData, and Strategy abstract base class.
These are the foundation for all trading strategies.
"""

import numpy as np
import pytest

from src.strategies.base import OHLCVData, Signal, SignalDirection, Strategy


class TestSignal:
    """Tests for Signal dataclass."""

    def test_valid_signal_creation(self):
        """Signal can be created with valid parameters."""
        signal = Signal(
            ticker="AAPL",
            direction=SignalDirection.LONG,
            strength=0.8,
            strategy_name="momentum",
            reason="Strong upward momentum",
        )

        assert signal.ticker == "AAPL"
        assert signal.direction == SignalDirection.LONG
        assert signal.strength == 0.8
        assert signal.strategy_name == "momentum"
        assert signal.reason == "Strong upward momentum"
        assert signal.metadata == {}

    def test_signal_with_metadata(self):
        """Signal can include metadata."""
        signal = Signal(
            ticker="MSFT",
            direction=SignalDirection.SHORT,
            strength=0.6,
            strategy_name="mean_reversion",
            reason="Overbought RSI",
            metadata={"rsi": 78, "period": 14},
        )

        assert signal.metadata["rsi"] == 78
        assert signal.metadata["period"] == 14

    def test_signal_strength_boundaries(self):
        """Signal strength must be in [0, 1]."""
        # Valid boundaries
        Signal(
            ticker="AAPL",
            direction=SignalDirection.LONG,
            strength=0.0,
            strategy_name="test",
            reason="test",
        )

        Signal(
            ticker="AAPL",
            direction=SignalDirection.LONG,
            strength=1.0,
            strategy_name="test",
            reason="test",
        )

    def test_signal_strength_below_zero_raises(self):
        """Signal strength < 0 raises ValueError."""
        with pytest.raises(ValueError, match="strength must be in"):
            Signal(
                ticker="AAPL",
                direction=SignalDirection.LONG,
                strength=-0.1,
                strategy_name="test",
                reason="test",
            )

    def test_signal_strength_above_one_raises(self):
        """Signal strength > 1 raises ValueError."""
        with pytest.raises(ValueError, match="strength must be in"):
            Signal(
                ticker="AAPL",
                direction=SignalDirection.LONG,
                strength=1.1,
                strategy_name="test",
                reason="test",
            )

    def test_signal_is_frozen(self):
        """Signal is immutable (frozen dataclass)."""
        signal = Signal(
            ticker="AAPL",
            direction=SignalDirection.LONG,
            strength=0.8,
            strategy_name="test",
            reason="test",
        )

        with pytest.raises(Exception):  # FrozenInstanceError or AttributeError
            signal.strength = 0.5  # type: ignore

    def test_signal_direction_enum(self):
        """SignalDirection enum has expected values."""
        assert SignalDirection.LONG == "long"
        assert SignalDirection.SHORT == "short"
        assert SignalDirection.FLAT == "flat"


class TestOHLCVData:
    """Tests for OHLCVData dataclass."""

    def test_ohlcv_creation(self):
        """OHLCVData can be created with arrays."""
        data = OHLCVData(
            ticker="AAPL",
            timestamps=np.array([0.0, 1.0, 2.0]),
            open=np.array([100.0, 101.0, 102.0]),
            high=np.array([102.0, 103.0, 104.0]),
            low=np.array([98.0, 99.0, 100.0]),
            close=np.array([101.0, 102.0, 103.0]),
            volume=np.array([1e6, 1.1e6, 1.2e6]),
        )

        assert data.ticker == "AAPL"
        assert len(data.timestamps) == 3
        assert len(data.open) == 3
        assert len(data.high) == 3
        assert len(data.low) == 3
        assert len(data.close) == 3
        assert len(data.volume) == 3

    def test_ohlcv_len(self):
        """len(OHLCVData) returns number of bars."""
        data = OHLCVData(
            ticker="MSFT",
            timestamps=np.arange(100, dtype=np.float64),
            open=np.zeros(100, dtype=np.float64),
            high=np.zeros(100, dtype=np.float64),
            low=np.zeros(100, dtype=np.float64),
            close=np.zeros(100, dtype=np.float64),
            volume=np.zeros(100, dtype=np.float64),
        )

        assert len(data) == 100

    def test_ohlcv_last_close(self):
        """last_close property returns last close price."""
        data = OHLCVData(
            ticker="GOOGL",
            timestamps=np.array([0.0, 1.0, 2.0]),
            open=np.array([100.0, 101.0, 102.0]),
            high=np.array([102.0, 103.0, 104.0]),
            low=np.array([98.0, 99.0, 100.0]),
            close=np.array([101.0, 102.0, 103.0]),
            volume=np.array([1e6, 1.1e6, 1.2e6]),
        )

        assert data.last_close == 103.0

    def test_ohlcv_last_volume(self):
        """last_volume property returns last volume."""
        data = OHLCVData(
            ticker="AMZN",
            timestamps=np.array([0.0, 1.0, 2.0]),
            open=np.array([100.0, 101.0, 102.0]),
            high=np.array([102.0, 103.0, 104.0]),
            low=np.array([98.0, 99.0, 100.0]),
            close=np.array([101.0, 102.0, 103.0]),
            volume=np.array([1e6, 1.1e6, 1.2e6]),
        )

        assert data.last_volume == 1.2e6

    def test_ohlcv_empty_arrays(self):
        """OHLCVData can be created with empty arrays."""
        data = OHLCVData(
            ticker="TSLA",
            timestamps=np.array([], dtype=np.float64),
            open=np.array([], dtype=np.float64),
            high=np.array([], dtype=np.float64),
            low=np.array([], dtype=np.float64),
            close=np.array([], dtype=np.float64),
            volume=np.array([], dtype=np.float64),
        )

        assert len(data) == 0

    def test_ohlcv_single_bar(self):
        """OHLCVData works with single bar."""
        data = OHLCVData(
            ticker="NVDA",
            timestamps=np.array([0.0]),
            open=np.array([100.0]),
            high=np.array([102.0]),
            low=np.array([98.0]),
            close=np.array([101.0]),
            volume=np.array([1e6]),
        )

        assert len(data) == 1
        assert data.last_close == 101.0
        assert data.last_volume == 1e6


class TestStrategy:
    """Tests for Strategy abstract base class."""

    def test_strategy_is_abstract(self):
        """Strategy cannot be instantiated directly."""
        with pytest.raises(TypeError):
            Strategy("test", "test description")  # type: ignore

    def test_concrete_strategy_implementation(self):
        """Concrete strategy can be created."""

        class ConcreteStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                return []

        strategy = ConcreteStrategy("momentum", "A momentum strategy", params={"period": 20})

        assert strategy.name == "momentum"
        assert strategy.description == "A momentum strategy"
        assert strategy.params["period"] == 20

    def test_strategy_without_params(self):
        """Strategy can be created without params."""

        class ConcreteStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                return []

        strategy = ConcreteStrategy("test", "test description")

        assert strategy.params == {}

    def test_strategy_generate_signals_must_be_implemented(self):
        """generate_signals must be implemented by subclass."""

        class IncompleteStrategy(Strategy):
            pass

        with pytest.raises(TypeError):
            IncompleteStrategy("incomplete", "incomplete strategy")  # type: ignore

    def test_strategy_validate_data_insufficient_bars(self):
        """validate_data returns False when not enough bars."""

        class ConcreteStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                return []

        strategy = ConcreteStrategy("test", "test")
        data = OHLCVData(
            ticker="AAPL",
            timestamps=np.arange(10, dtype=np.float64),
            open=np.zeros(10, dtype=np.float64),
            high=np.zeros(10, dtype=np.float64),
            low=np.zeros(10, dtype=np.float64),
            close=np.zeros(10, dtype=np.float64),
            volume=np.zeros(10, dtype=np.float64),
        )

        assert not strategy.validate_data(data, min_bars=20)

    def test_strategy_validate_data_sufficient_bars(self):
        """validate_data returns True when enough bars."""

        class ConcreteStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                return []

        strategy = ConcreteStrategy("test", "test")
        data = OHLCVData(
            ticker="AAPL",
            timestamps=np.arange(30, dtype=np.float64),
            open=np.zeros(30, dtype=np.float64),
            high=np.zeros(30, dtype=np.float64),
            low=np.zeros(30, dtype=np.float64),
            close=np.zeros(30, dtype=np.float64),
            volume=np.zeros(30, dtype=np.float64),
        )

        assert strategy.validate_data(data, min_bars=20)

    def test_strategy_repr(self):
        """Strategy __repr__ includes class name and name."""

        class ConcreteStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                return []

        strategy = ConcreteStrategy("momentum", "Momentum strategy")

        assert "ConcreteStrategy" in repr(strategy)
        assert "momentum" in repr(strategy)

    def test_strategy_generates_signals(self):
        """Strategy subclass can generate signals."""

        class MomentumStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                if len(data) < 2:
                    return []

                # Simple momentum: if last close > previous, go long
                if data.close[-1] > data.close[-2]:
                    return [
                        Signal(
                            ticker=data.ticker,
                            direction=SignalDirection.LONG,
                            strength=0.7,
                            strategy_name=self.name,
                            reason="Positive momentum",
                        )
                    ]
                return []

        strategy = MomentumStrategy("momentum", "Momentum strategy")
        data = OHLCVData(
            ticker="AAPL",
            timestamps=np.array([0.0, 1.0]),
            open=np.array([100.0, 101.0]),
            high=np.array([102.0, 103.0]),
            low=np.array([98.0, 99.0]),
            close=np.array([100.0, 102.0]),  # Upward momentum
            volume=np.array([1e6, 1.1e6]),
        )

        signals = strategy.generate_signals(data)

        assert len(signals) == 1
        assert signals[0].direction == SignalDirection.LONG
        assert signals[0].ticker == "AAPL"

    def test_strategy_returns_empty_list_when_no_signals(self):
        """Strategy returns empty list when no conditions met."""

        class ConditionalStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                # Only signal if close > 1000 (never true in this test)
                if data.last_close > 1000:
                    return [
                        Signal(
                            ticker=data.ticker,
                            direction=SignalDirection.LONG,
                            strength=0.5,
                            strategy_name=self.name,
                            reason="test",
                        )
                    ]
                return []

        strategy = ConditionalStrategy("conditional", "Conditional strategy")
        data = OHLCVData(
            ticker="AAPL",
            timestamps=np.array([0.0]),
            open=np.array([100.0]),
            high=np.array([102.0]),
            low=np.array([98.0]),
            close=np.array([101.0]),
            volume=np.array([1e6]),
        )

        signals = strategy.generate_signals(data)

        assert signals == []

    def test_strategy_can_generate_multiple_signals(self):
        """Strategy can return multiple signals."""

        class MultiSignalStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                return [
                    Signal(
                        ticker=data.ticker,
                        direction=SignalDirection.LONG,
                        strength=0.8,
                        strategy_name=self.name,
                        reason="Signal 1",
                    ),
                    Signal(
                        ticker=data.ticker,
                        direction=SignalDirection.SHORT,
                        strength=0.3,
                        strategy_name=self.name,
                        reason="Signal 2",
                    ),
                ]

        strategy = MultiSignalStrategy("multi", "Multi-signal strategy")
        data = OHLCVData(
            ticker="AAPL",
            timestamps=np.array([0.0]),
            open=np.array([100.0]),
            high=np.array([102.0]),
            low=np.array([98.0]),
            close=np.array([101.0]),
            volume=np.array([1e6]),
        )

        signals = strategy.generate_signals(data)

        assert len(signals) == 2
        assert signals[0].direction == SignalDirection.LONG
        assert signals[1].direction == SignalDirection.SHORT

    def test_strategy_uses_params(self):
        """Strategy can use custom parameters."""

        class ParameterizedStrategy(Strategy):
            def generate_signals(self, data: OHLCVData) -> list[Signal]:
                threshold = self.params.get("threshold", 100.0)
                if data.last_close > threshold:
                    return [
                        Signal(
                            ticker=data.ticker,
                            direction=SignalDirection.LONG,
                            strength=0.6,
                            strategy_name=self.name,
                            reason=f"Close above {threshold}",
                        )
                    ]
                return []

        strategy = ParameterizedStrategy("param", "Parameterized", params={"threshold": 95.0})
        data = OHLCVData(
            ticker="AAPL",
            timestamps=np.array([0.0]),
            open=np.array([100.0]),
            high=np.array([102.0]),
            low=np.array([98.0]),
            close=np.array([101.0]),  # Above 95 threshold
            volume=np.array([1e6]),
        )

        signals = strategy.generate_signals(data)

        assert len(signals) == 1
        assert "above 95" in signals[0].reason.lower()
