"""Portfolio optimization engine.

Implements portfolio construction and rebalancing using:
- Minimum variance optimization
- Risk parity (equal risk contribution)
- Maximum Sharpe ratio estimation
- Rebalancing logic with transaction cost awareness
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
from numpy.typing import NDArray


@dataclass
class OptimizationResult:
    """Result of portfolio optimization."""

    weights: dict[str, float]  # ticker → weight
    expected_return: float
    expected_volatility: float
    sharpe_ratio: float
    method: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RebalanceAction:
    """A single rebalancing trade."""

    ticker: str
    current_weight: float
    target_weight: float
    delta_weight: float  # target - current
    direction: str  # "buy" or "sell"
    priority: float  # Higher = more urgent


class PortfolioOptimizer:
    """Optimizes portfolio allocation and generates rebalancing trades.

    Uses return/covariance estimation from historical data to
    construct optimal portfolios under constraints.
    """

    def __init__(
        self,
        risk_free_rate: float = 0.05,
        max_weight: float = 0.20,
        min_weight: float = 0.0,
        transaction_cost_bps: float = 5.0,
    ) -> None:
        self.risk_free_rate = risk_free_rate
        self.max_weight = max_weight
        self.min_weight = min_weight
        self.transaction_cost_bps = transaction_cost_bps

    def estimate_returns(
        self,
        prices: dict[str, NDArray[np.float64]],
    ) -> tuple[NDArray[np.float64], NDArray[np.float64], list[str]]:
        """Estimate expected returns and covariance matrix from price history.

        Args:
            prices: Dict mapping ticker → array of historical prices.

        Returns:
            (expected_returns, covariance_matrix, tickers) sorted by ticker.
        """
        tickers = sorted(prices.keys())
        if not tickers:
            return np.array([]), np.array([[]]), []

        # Compute log returns
        returns_list = []
        for t in tickers:
            p = prices[t]
            log_ret = np.diff(np.log(p))
            returns_list.append(log_ret)

        # Align lengths (use minimum common length)
        min_len = min(len(r) for r in returns_list)
        returns_matrix = np.column_stack([r[-min_len:] for r in returns_list])

        # Annualized expected returns (assuming daily data, 252 trading days)
        expected_returns = np.mean(returns_matrix, axis=0) * 252
        cov_matrix = np.cov(returns_matrix, rowvar=False) * 252

        return expected_returns, cov_matrix, tickers

    def minimum_variance(
        self,
        prices: dict[str, NDArray[np.float64]],
    ) -> OptimizationResult:
        """Minimum variance portfolio — minimizes total portfolio volatility.

        Uses analytical solution for unconstrained min-variance,
        then applies weight constraints.
        """
        exp_ret, cov, tickers = self.estimate_returns(prices)
        n = len(tickers)

        if n == 0:
            return OptimizationResult(
                weights={},
                expected_return=0,
                expected_volatility=0,
                sharpe_ratio=0,
                method="minimum_variance",
            )

        # Analytical min-variance: w = Σ⁻¹ · 1 / (1ᵀ · Σ⁻¹ · 1)
        try:
            inv_cov = np.linalg.inv(cov)
        except np.linalg.LinAlgError:
            # Singular matrix — fall back to equal weight
            weights = np.full(n, 1.0 / n)
            return self._build_result(weights, exp_ret, cov, tickers, "minimum_variance")

        ones = np.ones(n)
        raw_weights = inv_cov @ ones / (ones @ inv_cov @ ones)

        # Apply constraints
        weights = self._apply_constraints(raw_weights)

        return self._build_result(weights, exp_ret, cov, tickers, "minimum_variance")

    def risk_parity(
        self,
        prices: dict[str, NDArray[np.float64]],
        iterations: int = 100,
    ) -> OptimizationResult:
        """Risk parity — each asset contributes equal risk to portfolio.

        Uses iterative inverse-volatility reweighting.
        """
        exp_ret, cov, tickers = self.estimate_returns(prices)
        n = len(tickers)

        if n == 0:
            return OptimizationResult(
                weights={},
                expected_return=0,
                expected_volatility=0,
                sharpe_ratio=0,
                method="risk_parity",
            )

        # Start with inverse-volatility weights
        vols = np.sqrt(np.diag(cov))
        vols = np.where(vols > 0, vols, 1.0)

        weights = 1.0 / vols
        weights = weights / np.sum(weights)

        # Iterative refinement
        for _ in range(iterations):
            port_var = weights @ cov @ weights
            if port_var <= 0:
                break
            port_vol = np.sqrt(port_var)
            # Marginal risk contribution
            mrc = cov @ weights / port_vol
            # Risk contribution
            rc = weights * mrc
            # Target equal risk
            target_rc = port_vol / n
            # Adjust weights
            adjustment = target_rc / rc
            adjustment = np.where(np.isfinite(adjustment), adjustment, 1.0)
            weights = weights * adjustment
            weights = self._apply_constraints(weights)

        weights = self._apply_constraints(weights)
        return self._build_result(weights, exp_ret, cov, tickers, "risk_parity")

    def max_sharpe(
        self,
        prices: dict[str, NDArray[np.float64]],
    ) -> OptimizationResult:
        """Maximum Sharpe ratio portfolio.

        Uses analytical tangency portfolio solution.
        """
        exp_ret, cov, tickers = self.estimate_returns(prices)
        n = len(tickers)

        if n == 0:
            return OptimizationResult(
                weights={},
                expected_return=0,
                expected_volatility=0,
                sharpe_ratio=0,
                method="max_sharpe",
            )

        excess_ret = exp_ret - self.risk_free_rate

        try:
            inv_cov = np.linalg.inv(cov)
        except np.linalg.LinAlgError:
            weights = np.full(n, 1.0 / n)
            return self._build_result(weights, exp_ret, cov, tickers, "max_sharpe")

        raw_weights = inv_cov @ excess_ret
        w_sum = np.sum(raw_weights)
        if w_sum == 0:
            weights = np.full(n, 1.0 / n)
        else:
            weights = raw_weights / w_sum

        weights = self._apply_constraints(weights)
        return self._build_result(weights, exp_ret, cov, tickers, "max_sharpe")

    def generate_rebalance_trades(
        self,
        current_weights: dict[str, float],
        target_weights: dict[str, float],
        min_trade_pct: float = 0.01,
    ) -> list[RebalanceAction]:
        """Generate rebalancing trades to move from current to target weights.

        Args:
            current_weights: Current portfolio weights by ticker.
            target_weights: Target portfolio weights by ticker.
            min_trade_pct: Minimum weight change to justify a trade (avoids churn).

        Returns:
            List of RebalanceAction sorted by priority (largest deviations first).
        """
        all_tickers = set(current_weights.keys()) | set(target_weights.keys())
        actions = []

        for ticker in all_tickers:
            current = current_weights.get(ticker, 0.0)
            target = target_weights.get(ticker, 0.0)
            delta = target - current

            # Skip small changes (transaction cost would exceed benefit)
            if abs(delta) < min_trade_pct:
                continue

            actions.append(
                RebalanceAction(
                    ticker=ticker,
                    current_weight=current,
                    target_weight=target,
                    delta_weight=delta,
                    direction="buy" if delta > 0 else "sell",
                    priority=abs(delta),
                )
            )

        # Sort by priority (largest deviations first)
        actions.sort(key=lambda a: a.priority, reverse=True)
        return actions

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _apply_constraints(self, weights: NDArray[np.float64]) -> NDArray[np.float64]:
        """Apply min/max weight constraints and normalize."""
        # Remove negative weights (no shorting in base model)
        weights = np.maximum(weights, self.min_weight)
        # Cap at max weight
        weights = np.minimum(weights, self.max_weight)
        # Renormalize
        total = np.sum(weights)
        if total > 0:
            weights = weights / total
        return weights

    def _build_result(
        self,
        weights: NDArray[np.float64],
        expected_returns: NDArray[np.float64],
        cov_matrix: NDArray[np.float64],
        tickers: list[str],
        method: str,
    ) -> OptimizationResult:
        """Build OptimizationResult from computed weights."""
        port_return = float(weights @ expected_returns)
        port_var = float(weights @ cov_matrix @ weights)
        port_vol = float(np.sqrt(max(port_var, 0)))
        sharpe = (port_return - self.risk_free_rate) / port_vol if port_vol > 0 else 0

        return OptimizationResult(
            weights={t: float(w) for t, w in zip(tickers, weights)},
            expected_return=port_return,
            expected_volatility=port_vol,
            sharpe_ratio=sharpe,
            method=method,
        )
