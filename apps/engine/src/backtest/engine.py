"""Backtesting engine.

Event-driven backtesting framework that simulates strategy execution
against historical data with realistic transaction costs and slippage.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from numpy.typing import NDArray

from src.strategies.base import OHLCVData, SignalDirection, Strategy

logger = logging.getLogger(__name__)


@dataclass
class TradeRecord:
    """Record of a single trade (entry + exit)."""

    ticker: str
    side: str  # "long" or "short"
    entry_price: float
    exit_price: float
    shares: int
    entry_bar: int
    exit_bar: int
    pnl: float
    pnl_pct: float
    holding_bars: int
    commission: float


@dataclass
class EquityCurve:
    """Time series of portfolio value."""

    timestamps: NDArray[np.float64]
    equity: NDArray[np.float64]
    cash: NDArray[np.float64]
    drawdown: NDArray[np.float64]

    @property
    def total_return(self) -> float:
        if len(self.equity) < 2 or self.equity[0] == 0:
            return 0.0
        return (self.equity[-1] / self.equity[0]) - 1.0

    @property
    def max_drawdown(self) -> float:
        if len(self.drawdown) == 0:
            return 0.0
        return float(np.min(self.drawdown))

    @property
    def peak_equity(self) -> float:
        return float(np.max(self.equity)) if len(self.equity) > 0 else 0.0


@dataclass
class BacktestResult:
    """Complete results of a backtest run."""

    strategy_name: str
    ticker: str
    start_bar: int
    end_bar: int
    initial_capital: float
    final_equity: float
    total_return: float
    annualized_return: float
    max_drawdown: float
    sharpe_ratio: float
    sortino_ratio: float
    win_rate: float
    profit_factor: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_win: float
    avg_loss: float
    avg_holding_bars: float
    equity_curve: EquityCurve
    trades: list[TradeRecord]
    metadata: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> dict[str, Any]:
        """Return a concise summary dict."""
        return {
            "strategy": self.strategy_name,
            "ticker": self.ticker,
            "total_return": f"{self.total_return:.2%}",
            "annualized_return": f"{self.annualized_return:.2%}",
            "max_drawdown": f"{self.max_drawdown:.2%}",
            "sharpe_ratio": f"{self.sharpe_ratio:.2f}",
            "sortino_ratio": f"{self.sortino_ratio:.2f}",
            "win_rate": f"{self.win_rate:.1%}",
            "profit_factor": f"{self.profit_factor:.2f}",
            "total_trades": self.total_trades,
            "avg_holding_bars": f"{self.avg_holding_bars:.1f}",
        }


class BacktestEngine:
    """Event-driven backtesting engine.

    Walks through historical bars, generates signals from the strategy,
    and simulates execution with configurable transaction costs.

    Supports:
    - Long and short positions
    - Configurable commission and slippage
    - Position sizing via fixed fraction or fixed shares
    - Bar-by-bar equity tracking
    """

    def __init__(
        self,
        initial_capital: float = 100_000.0,
        commission_per_share: float = 0.005,
        slippage_pct: float = 0.001,  # 10 bps
        position_size_pct: float = 0.10,
        max_holding_bars: int | None = None,
    ) -> None:
        self.initial_capital = initial_capital
        self.commission_per_share = commission_per_share
        self.slippage_pct = slippage_pct
        self.position_size_pct = position_size_pct
        self.max_holding_bars = max_holding_bars

    def run(self, strategy: Strategy, data: OHLCVData) -> BacktestResult:
        """Run a backtest of a strategy against historical data.

        Walks bar-by-bar, calls strategy.generate_signals() on expanding windows,
        and executes trades based on signals.
        """
        n = len(data)
        cash = self.initial_capital
        position = 0  # Current shares held (positive = long, negative = short)
        entry_price = 0.0
        entry_bar = 0

        trades: list[TradeRecord] = []
        equity_arr = np.zeros(n, dtype=np.float64)
        cash_arr = np.zeros(n, dtype=np.float64)

        # Minimum bars needed (walk-forward from bar 50)
        start_bar = min(50, n - 1)

        for i in range(n):
            current_price = float(data.close[i])

            # Calculate equity
            position_value = position * current_price
            equity_arr[i] = cash + position_value
            cash_arr[i] = cash

            if i < start_bar:
                continue

            # Check max holding period
            if self.max_holding_bars and position != 0:
                if (i - entry_bar) >= self.max_holding_bars:
                    cash, trade = self._close_position(
                        data.ticker,
                        position,
                        entry_price,
                        current_price,
                        entry_bar,
                        i,
                        cash,
                    )
                    trades.append(trade)
                    position = 0
                    continue

            # Generate signals on data up to current bar
            window = OHLCVData(
                ticker=data.ticker,
                timestamps=data.timestamps[: i + 1],
                open=data.open[: i + 1],
                high=data.high[: i + 1],
                low=data.low[: i + 1],
                close=data.close[: i + 1],
                volume=data.volume[: i + 1],
            )

            try:
                signals = strategy.generate_signals(window)
            except Exception as e:
                logger.warning(f"Strategy error at bar {i}: {e}")
                continue

            if not signals:
                continue

            # Use strongest signal
            best_signal = max(signals, key=lambda s: s.strength)

            # Execute signal
            if position == 0:
                # Enter position
                if best_signal.direction == SignalDirection.LONG:
                    shares = self._calculate_shares(cash, current_price)
                    if shares > 0:
                        fill_price = current_price * (1 + self.slippage_pct)
                        commission = shares * self.commission_per_share
                        cash -= shares * fill_price + commission
                        position = shares
                        entry_price = fill_price
                        entry_bar = i

                elif best_signal.direction == SignalDirection.SHORT:
                    shares = self._calculate_shares(cash, current_price)
                    if shares > 0:
                        fill_price = current_price * (1 - self.slippage_pct)
                        commission = shares * self.commission_per_share
                        cash += shares * fill_price - commission
                        position = -shares
                        entry_price = fill_price
                        entry_bar = i

            else:
                # Check for exit signal (opposite direction)
                should_exit = (position > 0 and best_signal.direction == SignalDirection.SHORT) or (
                    position < 0 and best_signal.direction == SignalDirection.LONG
                )
                if should_exit:
                    cash, trade = self._close_position(
                        data.ticker,
                        position,
                        entry_price,
                        current_price,
                        entry_bar,
                        i,
                        cash,
                    )
                    trades.append(trade)
                    position = 0

        # Close any open position at end
        if position != 0:
            final_price = float(data.close[-1])
            cash, trade = self._close_position(
                data.ticker,
                position,
                entry_price,
                final_price,
                entry_bar,
                n - 1,
                cash,
            )
            trades.append(trade)

        # Final equity
        equity_arr[-1] = cash

        return self._compute_results(
            strategy.name,
            data.ticker,
            start_bar,
            n - 1,
            equity_arr,
            cash_arr,
            trades,
        )

    def _calculate_shares(self, cash: float, price: float) -> int:
        """Calculate number of shares to buy/sell."""
        budget = cash * self.position_size_pct
        return int(budget / price) if price > 0 else 0

    def _close_position(
        self,
        ticker: str,
        position: int,
        entry_price: float,
        exit_price: float,
        entry_bar: int,
        exit_bar: int,
        cash: float,
    ) -> tuple[float, TradeRecord]:
        """Close a position and return updated cash + trade record."""
        shares = abs(position)
        commission = shares * self.commission_per_share

        if position > 0:  # Long
            fill_price = exit_price * (1 - self.slippage_pct)
            pnl = (fill_price - entry_price) * shares - commission * 2
            cash += shares * fill_price - commission
            side = "long"
        else:  # Short
            fill_price = exit_price * (1 + self.slippage_pct)
            pnl = (entry_price - fill_price) * shares - commission * 2
            cash -= shares * fill_price + commission
            side = "short"

        pnl_pct = pnl / (entry_price * shares) if entry_price * shares > 0 else 0

        trade = TradeRecord(
            ticker=ticker,
            side=side,
            entry_price=entry_price,
            exit_price=fill_price,
            shares=shares,
            entry_bar=entry_bar,
            exit_bar=exit_bar,
            pnl=pnl,
            pnl_pct=pnl_pct,
            holding_bars=exit_bar - entry_bar,
            commission=commission * 2,
        )

        return cash, trade

    def _compute_results(
        self,
        strategy_name: str,
        ticker: str,
        start_bar: int,
        end_bar: int,
        equity: NDArray[np.float64],
        cash: NDArray[np.float64],
        trades: list[TradeRecord],
    ) -> BacktestResult:
        """Compute performance metrics from equity curve and trades."""
        # Drawdown
        peak = np.maximum.accumulate(equity)
        drawdown = np.where(peak > 0, (equity - peak) / peak, 0.0)

        # Returns
        total_return = (
            (equity[-1] / self.initial_capital) - 1.0 if self.initial_capital > 0 else 0.0
        )
        n_bars = end_bar - start_bar + 1
        annualized_return = (1 + total_return) ** (252 / max(n_bars, 1)) - 1 if n_bars > 0 else 0

        # Daily returns for Sharpe/Sortino
        valid_equity = equity[equity > 0]
        if len(valid_equity) > 1:
            daily_returns = np.diff(valid_equity) / valid_equity[:-1]
            mean_return = np.mean(daily_returns)
            std_return = np.std(daily_returns, ddof=1) if len(daily_returns) > 1 else 0.0
            downside_returns = daily_returns[daily_returns < 0]
            downside_std = np.std(downside_returns, ddof=1) if len(downside_returns) > 1 else 0.0

            sharpe = (mean_return / std_return * np.sqrt(252)) if std_return > 0 else 0.0
            sortino = (mean_return / downside_std * np.sqrt(252)) if downside_std > 0 else 0.0
        else:
            sharpe = 0.0
            sortino = 0.0

        # Trade statistics
        wins = [t for t in trades if t.pnl > 0]
        losses = [t for t in trades if t.pnl <= 0]
        total_trades = len(trades)
        win_rate = len(wins) / total_trades if total_trades > 0 else 0.0
        avg_win = np.mean([t.pnl_pct for t in wins]) if wins else 0.0
        avg_loss = np.mean([t.pnl_pct for t in losses]) if losses else 0.0
        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))
        profit_factor = (
            gross_profit / gross_loss
            if gross_loss > 0
            else float("inf")
            if gross_profit > 0
            else 0.0
        )
        avg_holding = np.mean([t.holding_bars for t in trades]) if trades else 0.0

        curve = EquityCurve(
            timestamps=np.arange(len(equity), dtype=np.float64),
            equity=equity,
            cash=cash,
            drawdown=drawdown,
        )

        return BacktestResult(
            strategy_name=strategy_name,
            ticker=ticker,
            start_bar=start_bar,
            end_bar=end_bar,
            initial_capital=self.initial_capital,
            final_equity=float(equity[-1]),
            total_return=float(total_return),
            annualized_return=float(annualized_return),
            max_drawdown=float(np.min(drawdown)),
            sharpe_ratio=float(sharpe),
            sortino_ratio=float(sortino),
            win_rate=float(win_rate),
            profit_factor=float(profit_factor),
            total_trades=total_trades,
            winning_trades=len(wins),
            losing_trades=len(losses),
            avg_win=float(avg_win),
            avg_loss=float(avg_loss),
            avg_holding_bars=float(avg_holding),
            equity_curve=curve,
            trades=trades,
        )
