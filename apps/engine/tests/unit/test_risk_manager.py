"""Unit tests for RiskManager.

CRITICAL: RiskManager prevents catastrophic losses through:
- Drawdown circuit breakers (10% soft, 15% hard)
- Position concentration limits (5% per position, 20% per sector)
- Daily loss limits (2% max)
- Pre-trade risk checks

All edge cases and failure modes must be tested to prevent financial losses.
"""

from src.risk.position_sizer import RiskLimits
from src.risk.risk_manager import (
    AlertSeverity,
    PortfolioState,
    RiskAction,
    RiskAlert,
    RiskManager,
)


class TestRiskManagerDrawdownChecks:
    """Tests for drawdown monitoring and circuit breakers."""

    def test_no_drawdown_when_at_peak(self):
        """No alert when equity equals peak."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_drawdown(state)
        assert alert is None
        assert not manager.is_halted

    def test_soft_drawdown_warning(self):
        """Soft drawdown limit (10%) triggers warning."""
        manager = RiskManager()
        state = PortfolioState(
            equity=90_000,  # 10% drawdown from peak
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_drawdown(state)
        assert alert is not None
        assert alert.severity == AlertSeverity.WARNING
        assert alert.rule == "drawdown_soft_limit"
        assert alert.action == RiskAction.REDUCE
        assert "10.0%" in alert.message
        assert not manager.is_halted

    def test_hard_drawdown_circuit_breaker(self):
        """Hard drawdown limit (15%) halts all trading."""
        manager = RiskManager()
        state = PortfolioState(
            equity=85_000,  # 15% drawdown
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_drawdown(state)
        assert alert is not None
        assert alert.severity == AlertSeverity.CRITICAL
        assert alert.rule == "drawdown_hard_limit"
        assert alert.action == RiskAction.HALT
        assert "CIRCUIT BREAKER" in alert.message
        assert manager.is_halted

    def test_drawdown_between_soft_and_hard(self):
        """Drawdown between 10% and 15% triggers warning but not halt."""
        manager = RiskManager()
        state = PortfolioState(
            equity=87_500,  # 12.5% drawdown
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_drawdown(state)
        assert alert is not None
        assert alert.severity == AlertSeverity.WARNING
        assert not manager.is_halted

    def test_drawdown_with_zero_peak_equity(self):
        """Zero peak equity returns None (edge case)."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=0,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_drawdown(state)
        assert alert is None


class TestRiskManagerDailyLossChecks:
    """Tests for daily loss monitoring."""

    def test_no_alert_when_breakeven(self):
        """No alert when daily P&L is 0%."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_daily_loss(state)
        assert alert is None

    def test_no_alert_on_daily_profit(self):
        """No alert when daily P&L is positive."""
        manager = RiskManager()
        state = PortfolioState(
            equity=105_000,  # +5% daily gain
            cash=50_000,
            peak_equity=110_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_daily_loss(state)
        assert alert is None

    def test_daily_loss_limit_hit(self):
        """Daily loss of 2% triggers rejection alert."""
        manager = RiskManager()
        state = PortfolioState(
            equity=98_000,  # -2% daily loss
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_daily_loss(state)
        assert alert is not None
        assert alert.severity == AlertSeverity.CRITICAL
        assert alert.rule == "daily_loss_limit"
        assert alert.action == RiskAction.REJECT
        assert "no new positions" in alert.message.lower()

    def test_daily_loss_just_under_limit(self):
        """Daily loss of 1.9% does not trigger alert."""
        manager = RiskManager()
        state = PortfolioState(
            equity=98_100,  # -1.9% daily loss
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_daily_loss(state)
        assert alert is None

    def test_daily_loss_with_zero_starting_equity(self):
        """Zero starting equity returns None (edge case)."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=0,
            positions={},
            position_sectors={},
        )

        alert = manager.check_daily_loss(state)
        assert alert is None


class TestRiskManagerPreTradeChecksBuy:
    """Tests for pre-trade risk checks on buy orders."""

    def test_buy_allowed_when_all_checks_pass(self):
        """Buy passes when all risk checks are met."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        # 3 shares @ $150 = $450 = 0.45% of equity (within 5% limit)
        result = manager.pre_trade_check(
            ticker="AAPL", shares=3, price=150.0, side="buy", state=state, sector="tech"
        )

        assert result.allowed is True
        assert result.action == RiskAction.ALLOW
        assert "passed" in result.reason.lower()

    def test_buy_rejected_when_halted(self):
        """Buy rejected when circuit breaker is active."""
        manager = RiskManager()
        manager._halted = True  # Simulate circuit breaker
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        result = manager.pre_trade_check(
            ticker="AAPL", shares=100, price=150.0, side="buy", state=state
        )

        assert result.allowed is False
        assert result.action == RiskAction.HALT
        assert "circuit breaker" in result.reason.lower()

    def test_buy_rejected_for_position_concentration(self):
        """Buy rejected when position would exceed 5% limit."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={"AAPL": 5_000},  # Already at 5%
            position_sectors={"AAPL": "tech"},
        )

        # Try to add 100 shares @ $150 = $15,000 more (would be 20% total)
        result = manager.pre_trade_check(
            ticker="AAPL", shares=100, price=150.0, side="buy", state=state, sector="tech"
        )

        assert result.allowed is False
        assert result.action == RiskAction.REJECT
        assert "exceed" in result.reason.lower()

    def test_buy_reduced_for_position_concentration(self):
        """Buy reduced when full size would exceed limit."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={"AAPL": 3_000},  # 3% already
            position_sectors={"AAPL": "tech"},
        )

        # Max allowed: 5% = $5,000, already have $3,000, can add $2,000
        # At $150/share, that's 13 shares
        result = manager.pre_trade_check(
            ticker="AAPL", shares=100, price=150.0, side="buy", state=state, sector="tech"
        )

        assert result.allowed is True
        assert result.action == RiskAction.REDUCE
        assert result.adjusted_shares == 13
        assert "reduced" in result.reason.lower()

    def test_buy_rejected_for_sector_concentration(self):
        """Buy rejected when sector would exceed 20% limit."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={
                "AAPL": 5_000,
                "MSFT": 5_000,
                "GOOGL": 5_000,
                "AMZN": 5_000,
            },  # 20% in tech
            position_sectors={
                "AAPL": "tech",
                "MSFT": "tech",
                "GOOGL": "tech",
                "AMZN": "tech",
            },
        )

        # Try to add more tech
        result = manager.pre_trade_check(
            ticker="META", shares=10, price=200.0, side="buy", state=state, sector="tech"
        )

        assert result.allowed is False
        assert result.action == RiskAction.REJECT
        assert "sector" in result.reason.lower()

    def test_buy_rejected_for_max_open_positions(self):
        """Buy rejected when max open positions reached."""
        limits = RiskLimits(max_open_positions=3)
        manager = RiskManager(limits=limits)
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={"AAPL": 1_000, "MSFT": 1_000, "GOOGL": 1_000},  # 3 positions
            position_sectors={},
        )

        # Try to open 4th position
        result = manager.pre_trade_check(
            ticker="TSLA", shares=10, price=200.0, side="buy", state=state
        )

        assert result.allowed is False
        assert result.action == RiskAction.REJECT
        assert "max open positions" in result.reason.lower()

    def test_buy_allowed_when_adding_to_existing_position(self):
        """Buy allowed when adding to existing position (doesn't increase count)."""
        limits = RiskLimits(max_open_positions=3)
        manager = RiskManager(limits=limits)
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={"AAPL": 1_000, "MSFT": 1_000, "GOOGL": 1_000},  # 3 positions
            position_sectors={},
        )

        # Add to existing position (AAPL)
        result = manager.pre_trade_check(
            ticker="AAPL", shares=5, price=150.0, side="buy", state=state
        )

        assert result.allowed is True

    def test_buy_rejected_for_insufficient_cash(self):
        """Buy rejected when not enough cash."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=1_000,  # Only $1,000 cash
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        # Try to buy $15,000 worth
        result = manager.pre_trade_check(
            ticker="AAPL", shares=100, price=150.0, side="buy", state=state
        )

        assert result.allowed is False
        assert result.action == RiskAction.REJECT
        assert "insufficient cash" in result.reason.lower()

    def test_buy_reduced_for_cash_availability(self):
        """Buy reduced to affordable amount."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=5_000,  # $5,000 cash
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        # Try to buy 100 shares @ $150 = $15,000
        # Can afford 33 shares ($4,950)
        result = manager.pre_trade_check(
            ticker="AAPL", shares=100, price=150.0, side="buy", state=state
        )

        assert result.allowed is True
        assert result.action == RiskAction.REDUCE
        assert result.adjusted_shares == 33
        assert "cash availability" in result.reason.lower()

    def test_buy_rejected_when_daily_loss_limit_hit(self):
        """Buy rejected when daily loss limit reached."""
        manager = RiskManager()
        state = PortfolioState(
            equity=98_000,  # -2% daily loss
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        result = manager.pre_trade_check(
            ticker="AAPL", shares=10, price=150.0, side="buy", state=state
        )

        assert result.allowed is False
        assert result.action == RiskAction.REJECT
        assert "daily loss" in result.reason.lower()


class TestRiskManagerPreTradeChecksSell:
    """Tests for pre-trade risk checks on sell orders."""

    def test_sell_always_allowed(self):
        """Sells are always allowed (exit positions is good risk management)."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={"AAPL": 15_000},
            position_sectors={},
        )

        result = manager.pre_trade_check(
            ticker="AAPL", shares=100, price=150.0, side="sell", state=state
        )

        assert result.allowed is True
        assert result.action == RiskAction.ALLOW
        assert "always allowed" in result.reason.lower()

    def test_sell_allowed_even_when_halted(self):
        """Sells allowed even during circuit breaker."""
        manager = RiskManager()
        manager._halted = True
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={"AAPL": 15_000},
            position_sectors={},
        )

        result = manager.pre_trade_check(
            ticker="AAPL", shares=100, price=150.0, side="sell", state=state
        )

        assert result.allowed is True
        assert result.action == RiskAction.ALLOW


class TestRiskManagerPortfolioAssessment:
    """Tests for comprehensive portfolio risk assessment."""

    def test_assess_portfolio_with_no_positions(self):
        """Portfolio assessment with no open positions."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=100_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        assessment = manager.assess_portfolio_risk(state)

        assert assessment["equity"] == 100_000
        assert assessment["cash"] == 100_000
        assert assessment["cash_pct"] == 1.0
        assert assessment["invested_pct"] == 0.0
        assert assessment["drawdown"] == 0.0
        assert assessment["daily_pnl"] == 0.0
        assert assessment["position_count"] == 0
        assert len(assessment["alerts"]) == 0
        assert not assessment["halted"]

    def test_assess_portfolio_with_positions(self):
        """Portfolio assessment with open positions."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=40_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={
                "AAPL": 20_000,
                "MSFT": 20_000,
                "GOOGL": 20_000,
            },
            position_sectors={
                "AAPL": "tech",
                "MSFT": "tech",
                "GOOGL": "tech",
            },
        )

        assessment = manager.assess_portfolio_risk(state)

        assert assessment["equity"] == 100_000
        assert assessment["cash"] == 40_000
        assert assessment["cash_pct"] == 0.4
        assert assessment["invested_pct"] == 0.6
        assert assessment["position_count"] == 3
        assert "AAPL" in assessment["concentrations"]
        assert assessment["concentrations"]["AAPL"] == 0.2
        assert "tech" in assessment["sector_concentrations"]
        assert assessment["sector_concentrations"]["tech"] == 0.6

    def test_assess_portfolio_triggers_concentration_alerts(self):
        """Assessment generates alerts for position concentration violations."""
        manager = RiskManager()
        state = PortfolioState(
            equity=100_000,
            cash=40_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={"AAPL": 10_000},  # 10% (exceeds 5% limit)
            position_sectors={"AAPL": "tech"},
        )

        assessment = manager.assess_portfolio_risk(state)

        assert len(assessment["alerts"]) > 0
        alert = assessment["alerts"][0]
        assert alert["severity"] == "warning"
        assert alert["rule"] == "position_concentration"
        assert "AAPL" in alert["message"]

    def test_assess_portfolio_calculates_drawdown(self):
        """Assessment correctly calculates drawdown."""
        manager = RiskManager()
        state = PortfolioState(
            equity=90_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        assessment = manager.assess_portfolio_risk(state)

        assert assessment["drawdown"] == 0.1  # 10%

    def test_assess_portfolio_calculates_daily_pnl(self):
        """Assessment correctly calculates daily P&L."""
        manager = RiskManager()
        state = PortfolioState(
            equity=105_000,
            cash=50_000,
            peak_equity=105_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        assessment = manager.assess_portfolio_risk(state)

        assert assessment["daily_pnl"] == 0.05  # +5%

    def test_assess_portfolio_clears_previous_alerts(self):
        """Each assessment clears previous alerts."""
        manager = RiskManager()
        state1 = PortfolioState(
            equity=85_000,  # Hard drawdown
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        assessment1 = manager.assess_portfolio_risk(state1)
        assert len(assessment1["alerts"]) > 0

        # Second assessment with no issues
        state2 = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        assessment2 = manager.assess_portfolio_risk(state2)

        assert len(assessment2["alerts"]) == 0  # Alerts cleared


class TestRiskManagerCircuitBreakerReset:
    """Tests for manual circuit breaker reset."""

    def test_reset_halt_clears_halted_flag(self):
        """reset_halt() clears the halted flag."""
        manager = RiskManager()
        manager._halted = True

        manager.reset_halt()

        assert not manager.is_halted

    def test_reset_halt_creates_info_alert(self):
        """reset_halt() creates an info-level alert."""
        manager = RiskManager()
        manager._halted = True

        manager.reset_halt()

        alerts = manager.alerts
        assert len(alerts) > 0
        last_alert = alerts[-1]
        assert last_alert.severity == AlertSeverity.INFO
        assert last_alert.rule == "manual_reset"
        assert last_alert.action == RiskAction.ALLOW


class TestRiskManagerAlertManagement:
    """Tests for alert management."""

    def test_alerts_property_returns_copy(self):
        """alerts property returns a copy, not the original list."""
        manager = RiskManager()
        state = PortfolioState(
            equity=85_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        manager.check_drawdown(state)
        alerts = manager.alerts

        # Modifying returned list shouldn't affect internal state
        alerts.append(
            RiskAlert(
                severity=AlertSeverity.INFO, rule="test", message="test", action=RiskAction.ALLOW
            )
        )

        assert len(manager.alerts) == 1  # Original unchanged

    def test_clear_alerts_removes_all_alerts(self):
        """clear_alerts() removes all stored alerts."""
        manager = RiskManager()
        state = PortfolioState(
            equity=90_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        manager.check_drawdown(state)
        assert len(manager.alerts) > 0

        manager.clear_alerts()
        assert len(manager.alerts) == 0


class TestRiskManagerCustomLimits:
    """Tests for custom risk limits."""

    def test_custom_position_limit(self):
        """Custom position limit is enforced."""
        limits = RiskLimits(max_position_pct=0.10)  # 10% instead of 5%
        manager = RiskManager(limits=limits)
        state = PortfolioState(
            equity=100_000,
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        # Buy 10% position (should be allowed with custom limit)
        result = manager.pre_trade_check(
            ticker="AAPL",
            shares=66,
            price=150.0,
            side="buy",
            state=state,  # ~$10k = 10%
        )

        assert result.allowed is True

    def test_custom_drawdown_limits(self):
        """Custom drawdown limits are enforced."""
        limits = RiskLimits(max_drawdown_soft=0.05, max_drawdown_hard=0.08)  # 5% / 8%
        manager = RiskManager(limits=limits)
        state = PortfolioState(
            equity=94_000,  # 6% drawdown
            cash=50_000,
            peak_equity=100_000,
            daily_starting_equity=100_000,
            positions={},
            position_sectors={},
        )

        alert = manager.check_drawdown(state)

        # 6% drawdown exceeds 5% soft limit
        assert alert is not None
        assert alert.severity == AlertSeverity.WARNING
        assert not manager.is_halted  # But below 8% hard limit
