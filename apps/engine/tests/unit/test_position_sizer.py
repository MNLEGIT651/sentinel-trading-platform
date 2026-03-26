"""Unit tests for PositionSizer.

Tests all position sizing methods: fixed_fraction, volatility_target,
kelly_criterion, equal_weight, and risk_parity. Verifies risk limit
enforcement and edge case handling.
"""

import pytest

from src.risk.position_sizer import PositionSize, PositionSizer, RiskLimits, SizingMethod


class TestPositionSizerFixedFraction:
    """Tests for fixed_fraction method."""

    def test_basic_fixed_fraction(self):
        """Basic fixed fraction sizing."""
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        result = sizer.fixed_fraction(
            ticker="AAPL", price=150.0, risk_fraction=0.01, stop_distance=3.0
        )

        # Risk $1000 (1% of $100k), stop $3/share → 333 shares
        assert result.ticker == "AAPL"
        assert result.shares == 333
        assert result.dollar_amount == 333 * 150.0
        assert result.method == SizingMethod.FIXED_FRACTION
        assert result.risk_per_share == 3.0

    def test_default_stop_distance(self):
        """Stop distance defaults to 2% of price."""
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        result = sizer.fixed_fraction(ticker="MSFT", price=200.0, risk_fraction=0.01)

        # Stop = 200 * 0.02 = $4
        # Risk $1000 / $4 = 250 shares
        assert result.shares == 250
        assert result.risk_per_share == 4.0

    def test_respects_max_position_limit(self):
        """Position capped at max_position_pct."""
        limits = RiskLimits(max_position_pct=0.05)  # 5% max
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)

        # Large risk_fraction would exceed 5% limit
        result = sizer.fixed_fraction(ticker="TSLA", price=200.0, risk_fraction=0.10)

        # Max $5000 position (5% of $100k) → 25 shares at $200
        assert result.shares == 25
        assert result.dollar_amount == 5_000.0
        assert result.weight == 0.05

    def test_zero_stop_distance_returns_zero_shares(self):
        """Zero stop distance results in zero position."""
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.fixed_fraction(ticker="AAPL", price=150.0, stop_distance=0.0)

        assert result.shares == 0
        assert result.dollar_amount == 0.0

    def test_zero_equity_returns_zero_weight(self):
        """Zero equity results in zero weight."""
        sizer = PositionSizer(total_equity=0.0)
        result = sizer.fixed_fraction(ticker="AAPL", price=150.0)

        assert result.weight == 0.0


class TestPositionSizerVolatilityTarget:
    """Tests for volatility_target method."""

    def test_basic_volatility_target(self):
        """Basic volatility targeting."""
        limits = RiskLimits(max_position_pct=2.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        result = sizer.volatility_target(
            ticker="AAPL", price=150.0, atr=5.0, target_vol=0.10, atr_multiplier=2.0
        )

        # Risk budget = $100k * 0.10 = $10k
        # Stop distance = 5.0 * 2.0 = $10
        # Shares = $10k / $10 = 1000 shares
        assert result.shares == 1000
        assert result.dollar_amount == 150_000.0
        assert result.method == SizingMethod.VOLATILITY_TARGET
        assert result.risk_per_share == 10.0
        assert result.metadata["atr"] == 5.0

    def test_respects_max_position_limit(self):
        """Position capped at max_position_pct."""
        limits = RiskLimits(max_position_pct=0.05)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)

        # High volatility target would exceed 5% limit
        result = sizer.volatility_target(ticker="NVDA", price=500.0, atr=10.0, target_vol=0.50)

        # Max $5000 position → 10 shares at $500
        assert result.shares == 10
        assert result.dollar_amount == 5_000.0
        assert result.weight == 0.05

    def test_zero_atr_returns_zero_position(self):
        """Zero ATR results in zero position."""
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.volatility_target(ticker="AAPL", price=150.0, atr=0.0)

        assert result.shares == 0
        assert result.dollar_amount == 0.0
        assert result.weight == 0.0

    def test_zero_price_returns_zero_position(self):
        """Zero price results in zero position."""
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.volatility_target(ticker="AAPL", price=0.0, atr=5.0)

        assert result.shares == 0
        assert result.dollar_amount == 0.0

    def test_metadata_includes_atr_and_target_vol(self):
        """Metadata contains ATR and target volatility."""
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.volatility_target(ticker="MSFT", price=200.0, atr=8.0, target_vol=0.15)

        assert result.metadata["atr"] == 8.0
        assert result.metadata["target_vol"] == 0.15


class TestPositionSizerKellyCriterion:
    """Tests for kelly_criterion method."""

    def test_basic_kelly_criterion(self):
        """Basic Kelly Criterion sizing."""
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        result = sizer.kelly_criterion(
            ticker="AAPL",
            price=150.0,
            win_rate=0.60,
            avg_win=0.10,  # 10% avg win
            avg_loss=0.05,  # 5% avg loss
            fraction=0.25,  # Quarter-Kelly
        )

        # Kelly formula: (p * b - q) / b where b = avg_win/avg_loss = 2.0
        # f* = (0.6 * 2 - 0.4) / 2 = 0.4
        # Fractional Kelly (0.25) = 0.4 * 0.25 = 0.10 = 10%
        # Position = $100k * 0.10 = $10k → 66 shares at $150
        assert result.shares == 66
        assert result.method == SizingMethod.KELLY_CRITERION
        assert result.metadata["win_rate"] == 0.60
        assert result.metadata["kelly_pct"] == pytest.approx(0.4, abs=0.01)
        assert result.metadata["adjusted_pct"] == pytest.approx(0.10, abs=0.01)

    def test_negative_kelly_returns_zero_position(self):
        """Negative Kelly percentage results in zero position."""
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.kelly_criterion(
            ticker="AAPL",
            price=150.0,
            win_rate=0.30,  # Low win rate
            avg_win=0.05,
            avg_loss=0.10,  # High avg loss
        )

        # Kelly formula would be negative → clamped to 0
        assert result.shares == 0
        assert result.dollar_amount == 0.0

    def test_respects_max_position_limit(self):
        """Kelly percentage capped at max_position_pct."""
        limits = RiskLimits(max_position_pct=0.05)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)

        # Very favorable win rate/ratio would exceed 5% limit
        result = sizer.kelly_criterion(
            ticker="TSLA",
            price=200.0,
            win_rate=0.80,
            avg_win=0.20,
            avg_loss=0.05,
            fraction=1.0,  # Full Kelly
        )

        # Capped at 5% → $5000 position → 25 shares
        assert result.shares == 25
        assert result.dollar_amount == 5_000.0
        assert result.weight == 0.05

    def test_zero_avg_loss_returns_zero_position(self):
        """Zero avg_loss results in zero position."""
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.kelly_criterion(
            ticker="AAPL", price=150.0, win_rate=0.60, avg_win=0.10, avg_loss=0.0
        )

        assert result.shares == 0

    def test_zero_price_returns_zero_position(self):
        """Zero price results in zero position."""
        sizer = PositionSizer(total_equity=100_000)
        result = sizer.kelly_criterion(
            ticker="AAPL", price=0.0, win_rate=0.60, avg_win=0.10, avg_loss=0.05
        )

        assert result.shares == 0

    def test_quarter_kelly_safety_factor(self):
        """Quarter-Kelly (default) is safer than full Kelly."""
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)

        full_kelly = sizer.kelly_criterion(
            ticker="AAPL",
            price=150.0,
            win_rate=0.60,
            avg_win=0.10,
            avg_loss=0.05,
            fraction=1.0,
        )

        quarter_kelly = sizer.kelly_criterion(
            ticker="AAPL",
            price=150.0,
            win_rate=0.60,
            avg_win=0.10,
            avg_loss=0.05,
            fraction=0.25,
        )

        # Quarter-Kelly should be approximately 1/4 of full Kelly
        assert quarter_kelly.shares < full_kelly.shares
        assert quarter_kelly.dollar_amount == pytest.approx(full_kelly.dollar_amount / 4, rel=0.02)


class TestPositionSizerEqualWeight:
    """Tests for equal_weight method."""

    def test_basic_equal_weight(self):
        """Equal weight across 4 tickers."""
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        tickers = ["AAPL", "MSFT", "GOOGL", "AMZN"]
        prices = {"AAPL": 150.0, "MSFT": 300.0, "GOOGL": 100.0, "AMZN": 200.0}

        results = sizer.equal_weight(tickers, prices)

        # Each gets 25% → $25k
        assert len(results) == 4
        for result in results:
            assert result.weight == 0.25
            assert result.method == SizingMethod.EQUAL_WEIGHT
            assert result.dollar_amount == pytest.approx(25_000, rel=0.01)

    def test_empty_tickers_returns_empty_list(self):
        """Empty tickers list returns empty results."""
        sizer = PositionSizer(total_equity=100_000)
        results = sizer.equal_weight([], {})

        assert results == []

    def test_respects_max_position_limit(self):
        """Weight per position capped at max_position_pct."""
        limits = RiskLimits(max_position_pct=0.05)  # 5% max
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)

        # 2 tickers would get 50% each, but capped at 5%
        tickers = ["AAPL", "MSFT"]
        prices = {"AAPL": 150.0, "MSFT": 300.0}

        results = sizer.equal_weight(tickers, prices)

        for result in results:
            assert result.weight == 0.05
            assert result.dollar_amount == pytest.approx(5_000, abs=200)

    def test_zero_price_results_in_zero_shares(self):
        """Ticker with zero price gets zero shares."""
        sizer = PositionSizer(total_equity=100_000)
        tickers = ["AAPL", "INVALID"]
        prices = {"AAPL": 150.0, "INVALID": 0.0}

        results = sizer.equal_weight(tickers, prices)

        assert results[0].shares > 0  # AAPL
        assert results[1].shares == 0  # INVALID
        assert results[1].dollar_amount == 0.0


class TestPositionSizerRiskParity:
    """Tests for risk_parity method."""

    def test_basic_risk_parity(self):
        """Risk parity inversely weights by volatility."""
        limits = RiskLimits(max_position_pct=1.0)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        tickers = ["AAPL", "TSLA"]
        prices = {"AAPL": 150.0, "TSLA": 200.0}
        volatilities = {"AAPL": 0.20, "TSLA": 0.40}  # TSLA 2x more volatile

        results = sizer.risk_parity(tickers, prices, volatilities)

        # Inverse-vol weights: AAPL gets 2x weight of TSLA
        # After normalization: AAPL ~0.67, TSLA ~0.33
        assert len(results) == 2
        assert results[0].method == SizingMethod.RISK_PARITY
        assert results[0].weight > results[1].weight
        assert results[0].metadata["volatility"] == 0.20
        assert results[1].metadata["volatility"] == 0.40

    def test_empty_tickers_returns_empty_list(self):
        """Empty tickers returns empty results."""
        sizer = PositionSizer(total_equity=100_000)
        results = sizer.risk_parity([], {}, {})

        assert results == []

    def test_zero_volatility_falls_back_to_equal_weight(self):
        """All-zero volatility falls back to equal weight."""
        sizer = PositionSizer(total_equity=100_000)
        tickers = ["AAPL", "MSFT"]
        prices = {"AAPL": 150.0, "MSFT": 300.0}
        volatilities = {"AAPL": 0.0, "MSFT": 0.0}

        results = sizer.risk_parity(tickers, prices, volatilities)

        # Falls back to equal weight
        assert results[0].weight == results[1].weight

    def test_respects_max_position_limit(self):
        """Individual positions capped at max_position_pct before renormalization."""
        limits = RiskLimits(max_position_pct=0.10)
        sizer = PositionSizer(total_equity=100_000, risk_limits=limits)
        # 5 tickers with highly skewed volatilities: A is very low-vol → would get huge raw weight
        tickers = ["A", "B", "C", "D", "E"]
        prices = {"A": 100.0, "B": 100.0, "C": 100.0, "D": 100.0, "E": 100.0}
        volatilities = {"A": 0.01, "B": 0.40, "C": 0.40, "D": 0.40, "E": 0.40}

        results = sizer.risk_parity(tickers, prices, volatilities)

        # Without clamp, A would dominate (inv-vol ~100 vs 2.5 each).
        # The clamp at 10% limits A, then renormalization distributes the rest.
        # A's raw weight is capped and should not dominate the portfolio.
        assert results[0].weight < 0.90  # Would be ~0.97 without cap

    def test_missing_volatility_uses_default(self):
        """Missing volatility uses 0.20 default."""
        sizer = PositionSizer(total_equity=100_000)
        tickers = ["AAPL", "UNKNOWN"]
        prices = {"AAPL": 150.0, "UNKNOWN": 100.0}
        volatilities = {"AAPL": 0.20}  # UNKNOWN missing

        results = sizer.risk_parity(tickers, prices, volatilities)

        # Both should have same volatility (0.20 default)
        assert results[0].weight == pytest.approx(results[1].weight, abs=0.01)


class TestRiskLimits:
    """Tests for RiskLimits dataclass."""

    def test_default_limits(self):
        """Default risk limits are set."""
        limits = RiskLimits()
        assert limits.max_position_pct == 0.05
        assert limits.max_sector_pct == 0.20
        assert limits.max_portfolio_risk_pct == 0.02
        assert limits.max_drawdown_soft == 0.10
        assert limits.max_drawdown_hard == 0.15
        assert limits.max_correlated_exposure == 0.30
        assert limits.max_open_positions == 20

    def test_custom_limits(self):
        """Custom risk limits can be set."""
        limits = RiskLimits(
            max_position_pct=0.10,
            max_sector_pct=0.30,
            max_drawdown_hard=0.20,
        )
        assert limits.max_position_pct == 0.10
        assert limits.max_sector_pct == 0.30
        assert limits.max_drawdown_hard == 0.20


class TestPositionSize:
    """Tests for PositionSize dataclass."""

    def test_position_size_creation(self):
        """PositionSize can be created with all fields."""
        pos = PositionSize(
            ticker="AAPL",
            shares=100,
            dollar_amount=15_000.0,
            weight=0.15,
            method=SizingMethod.FIXED_FRACTION,
            risk_per_share=3.0,
            metadata={"note": "test"},
        )

        assert pos.ticker == "AAPL"
        assert pos.shares == 100
        assert pos.dollar_amount == 15_000.0
        assert pos.weight == 0.15
        assert pos.method == SizingMethod.FIXED_FRACTION
        assert pos.risk_per_share == 3.0
        assert pos.metadata["note"] == "test"

    def test_position_size_immutable(self):
        """PositionSize is frozen (immutable)."""
        pos = PositionSize(
            ticker="AAPL",
            shares=100,
            dollar_amount=15_000.0,
            weight=0.15,
            method=SizingMethod.FIXED_FRACTION,
            risk_per_share=3.0,
        )

        with pytest.raises(Exception):  # FrozenInstanceError or AttributeError
            pos.shares = 200  # type: ignore
