import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BacktestForm } from '@/components/backtest/backtest-form';

const defaultProps = {
  strategy: 'sma_crossover',
  onStrategy: vi.fn(),
  trend: 'up' as const,
  onTrend: vi.fn(),
  bars: 200,
  onBars: vi.fn(),
  capital: 10000,
  onCapital: vi.fn(),
  isRunning: false,
  onRun: vi.fn(),
};

describe('BacktestForm', () => {
  it('renders a run button', () => {
    render(<BacktestForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Run Backtest/i })).toBeInTheDocument();
  });

  it('button is disabled when isRunning=true', () => {
    render(<BacktestForm {...defaultProps} isRunning={true} />);
    const btn = screen.getByRole('button', { name: /Running/i });
    expect(btn).toBeDisabled();
  });
});
