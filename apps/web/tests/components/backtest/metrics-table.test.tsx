import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsTable } from '@/components/backtest/metrics-table';
import type { BacktestSummary } from '@/components/backtest/metrics-table';

const mockSummary: BacktestSummary = {
  strategy: 'sma_crossover',
  ticker: 'AAPL',
  initial_capital: 10000,
  final_equity: 11200,
  total_return: 0.12,
  total_trades: 20,
  win_rate: 0.6,
  sharpe_ratio: 1.5,
  sortino_ratio: 1.8,
  max_drawdown: -0.08,
  profit_factor: 1.75,
  avg_trade_pnl: 60,
  avg_holding_bars: 5,
};

describe('MetricsTable', () => {
  it('renders metrics when passed non-null data', () => {
    render(<MetricsTable summary={mockSummary} />);
    expect(screen.getByText('Total Return')).toBeInTheDocument();
    expect(screen.getByText('12.00%')).toBeInTheDocument();
  });

  it('renders Sharpe Ratio metric', () => {
    render(<MetricsTable summary={mockSummary} />);
    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
  });
});
