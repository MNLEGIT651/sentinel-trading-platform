"""Position sizing models.

Determines how much capital to allocate to each trade based on
risk parameters, volatility, and portfolio constraints.
Implements the Layer B concept: risk parity and drawdown controls.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

import numpy as np


class SizingMethod(StrEnum):
    """Position sizing method."""

    FIXED_FRACTION = "fixed_fraction"
    VOLATILITY_TARGET = "volatility_target"
    KELLY_CRITERION = "kelly_criterion"
    EQUAL_WEIGHT = "equal_weight"
    RISK_PARITY = "risk_parity"


@dataclass(frozen=True)
class PositionSize:
    """Result of position sizing calculation."""

    ticker: str
    shares: int
    dollar_amount: float
    weight: float  # Portfolio weight (0-1)
    method: SizingMethod
    risk_per_share: float  # Dollar risk per share (ATR or stop distance)
    metadata: dict | None = None


@dataclass
class RiskLimits:
    """Risk limits configuration.

    Based on the trading blueprint's Layer B risk controls.
    """

    max_position_pct: float = 0.05  # 5% max single position
    max_sector_pct: float = 0.20  # 20% max sector concentration
    max_portfolio_risk_pct: float = 0.02  # 2% daily loss limit
    max_drawdown_soft: float = 0.10  # 10% drawdown warning
    max_drawdown_hard: float = 0.15  # 15% drawdown circuit breaker
    max_correlated_exposure: float = 0.30  # 30% max correlated group
    max_open_positions: int = 20


class PositionSizer:
    """Calculates optimal position sizes given risk constraints.

    Supports multiple sizing methods and enforces risk limits.
    """

    def __init__(
        self,
        total_equity: float,
        risk_limits: RiskLimits | None = None,
    ) -> None:
        self.total_equity = total_equity
        self.limits = risk_limits or RiskLimits()

    def fixed_fraction(
        self,
        ticker: str,
        price: float,
        risk_fraction: float = 0.01,
        stop_distance: float | None = None,
    ) -> PositionSize:
        """Fixed fraction of equity at risk per trade.

        Args:
            ticker: Instrument ticker.
            price: Current price per share.
            risk_fraction: Fraction of equity to risk (default 1%).
            stop_distance: Dollar distance to stop loss. If None, uses 2% of price.
        """
        if stop_distance is None:
            stop_distance = price * 0.02

        dollar_risk = self.total_equity * risk_fraction
        raw_shares = dollar_risk / stop_distance if stop_distance > 0 else 0
        shares = int(raw_shares)

        dollar_amount = shares * price
        weight = dollar_amount / self.total_equity if self.total_equity > 0 else 0

        # Enforce max position limit
        max_amount = self.total_equity * self.limits.max_position_pct
        if dollar_amount > max_amount:
            shares = int(max_amount / price)
            dollar_amount = shares * price
            weight = dollar_amount / self.total_equity

        return PositionSize(
            ticker=ticker,
            shares=shares,
            dollar_amount=dollar_amount,
            weight=weight,
            method=SizingMethod.FIXED_FRACTION,
            risk_per_share=stop_distance,
        )

    def volatility_target(
        self,
        ticker: str,
        price: float,
        atr: float,
        target_vol: float = 0.10,
        atr_multiplier: float = 2.0,
    ) -> PositionSize:
        """Size position to target portfolio volatility contribution.

        Uses ATR as a proxy for expected volatility.
        Position sized so that atr_multiplier * ATR * shares ≈ target_vol * equity.
        """
        if atr <= 0 or price <= 0:
            return PositionSize(
                ticker=ticker,
                shares=0,
                dollar_amount=0.0,
                weight=0.0,
                method=SizingMethod.VOLATILITY_TARGET,
                risk_per_share=0.0,
            )

        risk_budget = self.total_equity * target_vol
        stop_distance = atr * atr_multiplier
        raw_shares = risk_budget / stop_distance
        shares = int(raw_shares)

        dollar_amount = shares * price
        weight = dollar_amount / self.total_equity if self.total_equity > 0 else 0

        # Enforce limits
        max_amount = self.total_equity * self.limits.max_position_pct
        if dollar_amount > max_amount:
            shares = int(max_amount / price)
            dollar_amount = shares * price
            weight = dollar_amount / self.total_equity

        return PositionSize(
            ticker=ticker,
            shares=shares,
            dollar_amount=dollar_amount,
            weight=weight,
            method=SizingMethod.VOLATILITY_TARGET,
            risk_per_share=stop_distance,
            metadata={"atr": atr, "target_vol": target_vol},
        )

    def kelly_criterion(
        self,
        ticker: str,
        price: float,
        win_rate: float,
        avg_win: float,
        avg_loss: float,
        fraction: float = 0.25,  # Quarter-Kelly for safety
    ) -> PositionSize:
        """Kelly Criterion position sizing.

        Uses fractional Kelly (default 25%) for safety.

        Args:
            win_rate: Historical win probability (0-1).
            avg_win: Average winning trade return.
            avg_loss: Average losing trade return (positive number).
            fraction: Kelly fraction (0.25 = quarter-Kelly).
        """
        if avg_loss <= 0 or price <= 0:
            return PositionSize(
                ticker=ticker,
                shares=0,
                dollar_amount=0.0,
                weight=0.0,
                method=SizingMethod.KELLY_CRITERION,
                risk_per_share=0.0,
            )

        # Kelly formula: f* = (p * b - q) / b
        # where p = win_rate, q = 1-p, b = avg_win/avg_loss
        b = avg_win / avg_loss
        q = 1.0 - win_rate
        kelly_pct = (win_rate * b - q) / b

        # Apply fractional Kelly and clamp
        adjusted_pct = max(kelly_pct * fraction, 0.0)
        adjusted_pct = min(adjusted_pct, self.limits.max_position_pct)

        dollar_amount = self.total_equity * adjusted_pct
        shares = int(dollar_amount / price)
        dollar_amount = shares * price
        weight = dollar_amount / self.total_equity if self.total_equity > 0 else 0

        return PositionSize(
            ticker=ticker,
            shares=shares,
            dollar_amount=dollar_amount,
            weight=weight,
            method=SizingMethod.KELLY_CRITERION,
            risk_per_share=price * avg_loss,
            metadata={"kelly_pct": kelly_pct, "adjusted_pct": adjusted_pct, "win_rate": win_rate},
        )

    def equal_weight(
        self,
        tickers: list[str],
        prices: dict[str, float],
    ) -> list[PositionSize]:
        """Equal-weight allocation across instruments."""
        n = len(tickers)
        if n == 0:
            return []

        weight_per = 1.0 / n
        max_weight = self.limits.max_position_pct
        weight_per = min(weight_per, max_weight)
        budget_per = self.total_equity * weight_per

        return [
            PositionSize(
                ticker=t,
                shares=int(budget_per / prices[t]) if prices.get(t, 0) > 0 else 0,
                dollar_amount=int(budget_per / prices[t]) * prices[t]
                if prices.get(t, 0) > 0
                else 0,
                weight=weight_per,
                method=SizingMethod.EQUAL_WEIGHT,
                risk_per_share=prices.get(t, 0) * 0.02,
            )
            for t in tickers
        ]

    def risk_parity(
        self,
        tickers: list[str],
        prices: dict[str, float],
        volatilities: dict[str, float],
    ) -> list[PositionSize]:
        """Risk parity allocation — equal risk contribution per position.

        Weights are inversely proportional to volatility so each position
        contributes equal risk to the portfolio.
        """
        if not tickers:
            return []

        vols = np.array([volatilities.get(t, 0.20) for t in tickers])
        if np.all(vols == 0):
            return self.equal_weight(tickers, prices)

        # Inverse-volatility weights
        inv_vol = np.where(vols > 0, 1.0 / vols, 0.0)
        raw_weights = inv_vol / np.sum(inv_vol)

        # Clamp to max position
        raw_weights = np.minimum(raw_weights, self.limits.max_position_pct)
        total = np.sum(raw_weights)
        if total > 0:
            raw_weights = raw_weights / total  # Renormalize

        results = []
        for i, t in enumerate(tickers):
            w = float(raw_weights[i])
            budget = self.total_equity * w
            price = prices.get(t, 0)
            shares = int(budget / price) if price > 0 else 0
            results.append(
                PositionSize(
                    ticker=t,
                    shares=shares,
                    dollar_amount=shares * price,
                    weight=w,
                    method=SizingMethod.RISK_PARITY,
                    risk_per_share=price * vols[i] if price > 0 else 0,
                    metadata={"volatility": float(vols[i])},
                )
            )

        return results
