"""Risk management engine.

Implements Layer B of the trading blueprint:
- Drawdown circuit breakers (10% soft, 15% hard)
- Position concentration limits
- Daily loss limits
- Volatility targeting
- Pre-trade risk checks
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from src.risk.position_sizer import RiskLimits

logger = logging.getLogger(__name__)


class RiskAction(StrEnum):
    """Action taken by risk manager."""

    ALLOW = "allow"
    REDUCE = "reduce"
    REJECT = "reject"
    LIQUIDATE = "liquidate"
    HALT = "halt"


class AlertSeverity(StrEnum):
    """Risk alert severity level."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass(frozen=True)
class RiskAlert:
    """Risk alert emitted by the risk manager."""

    severity: AlertSeverity
    rule: str
    message: str
    action: RiskAction
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PreTradeCheck:
    """Result of a pre-trade risk check."""

    allowed: bool
    action: RiskAction
    reason: str
    adjusted_shares: int | None = None  # If reduced, the adjusted quantity


@dataclass
class PortfolioState:
    """Current portfolio state for risk assessment."""

    equity: float
    cash: float
    peak_equity: float
    daily_starting_equity: float
    positions: dict[str, float]  # ticker → market value
    position_sectors: dict[str, str]  # ticker → sector


class RiskManager:
    """Enforces risk controls on the trading portfolio.

    Checks pre-trade limits, monitors drawdowns, and can trigger
    circuit breakers when risk thresholds are exceeded.
    """

    def __init__(self, limits: RiskLimits | None = None) -> None:
        self.limits = limits or RiskLimits()
        self._alerts: list[RiskAlert] = []
        self._halted = False

    @property
    def is_halted(self) -> bool:
        return self._halted

    @property
    def alerts(self) -> list[RiskAlert]:
        return list(self._alerts)

    def clear_alerts(self) -> None:
        self._alerts.clear()

    # ------------------------------------------------------------------
    # Drawdown Monitoring
    # ------------------------------------------------------------------

    def check_drawdown(self, state: PortfolioState) -> RiskAlert | None:
        """Check current drawdown against limits."""
        if state.peak_equity <= 0:
            return None

        drawdown = (state.peak_equity - state.equity) / state.peak_equity

        if drawdown >= self.limits.max_drawdown_hard:
            alert = RiskAlert(
                severity=AlertSeverity.CRITICAL,
                rule="drawdown_hard_limit",
                message=(
                    f"CIRCUIT BREAKER: Drawdown {drawdown:.1%} exceeds "
                    f"hard limit {self.limits.max_drawdown_hard:.0%}. "
                    f"All trading halted."
                ),
                action=RiskAction.HALT,
                metadata={"drawdown": drawdown, "peak": state.peak_equity, "current": state.equity},
            )
            self._halted = True
            self._alerts.append(alert)
            return alert

        if drawdown >= self.limits.max_drawdown_soft:
            alert = RiskAlert(
                severity=AlertSeverity.WARNING,
                rule="drawdown_soft_limit",
                message=(
                    f"Drawdown warning: {drawdown:.1%} exceeds "
                    f"soft limit {self.limits.max_drawdown_soft:.0%}. "
                    f"Reducing position sizes."
                ),
                action=RiskAction.REDUCE,
                metadata={"drawdown": drawdown, "peak": state.peak_equity, "current": state.equity},
            )
            self._alerts.append(alert)
            return alert

        return None

    # ------------------------------------------------------------------
    # Daily Loss Check
    # ------------------------------------------------------------------

    def check_daily_loss(self, state: PortfolioState) -> RiskAlert | None:
        """Check daily P&L against limit."""
        if state.daily_starting_equity <= 0:
            return None

        daily_pnl = (state.equity - state.daily_starting_equity) / state.daily_starting_equity

        if daily_pnl <= -self.limits.max_portfolio_risk_pct:
            alert = RiskAlert(
                severity=AlertSeverity.CRITICAL,
                rule="daily_loss_limit",
                message=f"Daily loss limit hit: {daily_pnl:.1%}. No new positions allowed today.",
                action=RiskAction.REJECT,
                metadata={"daily_pnl": daily_pnl, "limit": self.limits.max_portfolio_risk_pct},
            )
            self._alerts.append(alert)
            return alert

        return None

    # ------------------------------------------------------------------
    # Pre-Trade Checks
    # ------------------------------------------------------------------

    def pre_trade_check(
        self,
        ticker: str,
        shares: int,
        price: float,
        side: str,  # "buy" or "sell"
        state: PortfolioState,
        sector: str = "unknown",
    ) -> PreTradeCheck:
        """Run all pre-trade risk checks.

        Returns a PreTradeCheck indicating whether the trade is allowed,
        should be reduced, or must be rejected.
        """
        if self._halted:
            return PreTradeCheck(
                allowed=False,
                action=RiskAction.HALT,
                reason="Trading halted — circuit breaker active",
            )

        if side == "buy":
            return self._check_buy(ticker, shares, price, state, sector)
        return PreTradeCheck(
            allowed=True, action=RiskAction.ALLOW, reason="Sells are always allowed"
        )

    def _check_buy(
        self,
        ticker: str,
        shares: int,
        price: float,
        state: PortfolioState,
        sector: str,
    ) -> PreTradeCheck:
        """Check buy-side risk limits."""
        trade_value = shares * price
        new_position_value = state.positions.get(ticker, 0.0) + trade_value

        # 1. Position concentration limit
        position_pct = new_position_value / state.equity if state.equity > 0 else 1.0
        if position_pct > self.limits.max_position_pct:
            max_value = state.equity * self.limits.max_position_pct
            remaining = max_value - state.positions.get(ticker, 0.0)
            adjusted = max(int(remaining / price), 0)

            if adjusted <= 0:
                return PreTradeCheck(
                    allowed=False,
                    action=RiskAction.REJECT,
                    reason=(
                        f"Position {ticker} would exceed "
                        f"{self.limits.max_position_pct:.0%} limit "
                        f"({position_pct:.1%})"
                    ),
                )
            return PreTradeCheck(
                allowed=True,
                action=RiskAction.REDUCE,
                reason=f"Position reduced from {shares} to {adjusted} shares (position limit)",
                adjusted_shares=adjusted,
            )

        # 2. Sector concentration limit
        sector_value = sum(
            v for t, v in state.positions.items() if state.position_sectors.get(t) == sector
        )
        sector_value += trade_value
        sector_pct = sector_value / state.equity if state.equity > 0 else 1.0
        if sector_pct > self.limits.max_sector_pct:
            return PreTradeCheck(
                allowed=False,
                action=RiskAction.REJECT,
                reason=(
                    f"Sector '{sector}' would exceed "
                    f"{self.limits.max_sector_pct:.0%} limit "
                    f"({sector_pct:.1%})"
                ),
            )

        # 3. Max open positions
        current_positions = len(state.positions)
        if ticker not in state.positions and current_positions >= self.limits.max_open_positions:
            return PreTradeCheck(
                allowed=False,
                action=RiskAction.REJECT,
                reason=f"Max open positions ({self.limits.max_open_positions}) reached",
            )

        # 4. Cash availability
        if trade_value > state.cash:
            affordable = int(state.cash / price) if price > 0 else 0
            if affordable <= 0:
                return PreTradeCheck(
                    allowed=False,
                    action=RiskAction.REJECT,
                    reason=f"Insufficient cash: need ${trade_value:.2f}, have ${state.cash:.2f}",
                )
            return PreTradeCheck(
                allowed=True,
                action=RiskAction.REDUCE,
                reason=f"Reduced to {affordable} shares due to cash availability",
                adjusted_shares=affordable,
            )

        # 5. Daily loss check
        daily_alert = self.check_daily_loss(state)
        if daily_alert and daily_alert.action == RiskAction.REJECT:
            return PreTradeCheck(
                allowed=False,
                action=RiskAction.REJECT,
                reason="Daily loss limit reached — no new positions today",
            )

        return PreTradeCheck(
            allowed=True,
            action=RiskAction.ALLOW,
            reason="All risk checks passed",
        )

    # ------------------------------------------------------------------
    # Portfolio Risk Assessment
    # ------------------------------------------------------------------

    def assess_portfolio_risk(self, state: PortfolioState) -> dict[str, Any]:
        """Generate a comprehensive risk assessment of current portfolio."""
        self.clear_alerts()

        total_invested = sum(state.positions.values())
        cash_pct = state.cash / state.equity if state.equity > 0 else 1.0
        invested_pct = total_invested / state.equity if state.equity > 0 else 0.0

        drawdown = 0.0
        if state.peak_equity > 0:
            drawdown = (state.peak_equity - state.equity) / state.peak_equity

        daily_pnl = 0.0
        if state.daily_starting_equity > 0:
            daily_pnl = (state.equity - state.daily_starting_equity) / state.daily_starting_equity

        # Position concentrations
        concentrations = {}
        for ticker, value in state.positions.items():
            concentrations[ticker] = value / state.equity if state.equity > 0 else 0

        # Sector concentrations
        sector_totals: dict[str, float] = {}
        for ticker, value in state.positions.items():
            sector = state.position_sectors.get(ticker, "unknown")
            sector_totals[sector] = sector_totals.get(sector, 0) + value

        sector_concentrations = {
            s: v / state.equity if state.equity > 0 else 0 for s, v in sector_totals.items()
        }

        # Check limits
        self.check_drawdown(state)
        self.check_daily_loss(state)

        # Check individual position limits
        for ticker, pct in concentrations.items():
            if pct > self.limits.max_position_pct:
                self._alerts.append(
                    RiskAlert(
                        severity=AlertSeverity.WARNING,
                        rule="position_concentration",
                        message=(
                            f"{ticker} exceeds position limit: "
                            f"{pct:.1%} > "
                            f"{self.limits.max_position_pct:.0%}"
                        ),
                        action=RiskAction.REDUCE,
                        metadata={"ticker": ticker, "concentration": pct},
                    )
                )

        return {
            "equity": state.equity,
            "cash": state.cash,
            "cash_pct": cash_pct,
            "invested_pct": invested_pct,
            "drawdown": drawdown,
            "daily_pnl": daily_pnl,
            "position_count": len(state.positions),
            "concentrations": concentrations,
            "sector_concentrations": sector_concentrations,
            "alerts": [
                {
                    "severity": a.severity.value,
                    "rule": a.rule,
                    "message": a.message,
                    "action": a.action.value,
                }
                for a in self._alerts
            ],
            "halted": self._halted,
        }

    def reset_halt(self) -> None:
        """Manually reset circuit breaker (requires human approval)."""
        self._halted = False
        self._alerts.append(
            RiskAlert(
                severity=AlertSeverity.INFO,
                rule="manual_reset",
                message="Circuit breaker manually reset",
                action=RiskAction.ALLOW,
            )
        )
