import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BacktestPage from '@/app/(dashboard)/backtest/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/backtest',
  useRouter: () => ({ push: vi.fn() }),
}));

const mockResponse = {
  summary: {
    strategy: 'SMA Crossover',
    ticker: 'AAPL',
    total_return: '12.50%',
    total_trades: 14,
    win_rate: '57.14%',
    sharpe_ratio: '1.22',
    sortino_ratio: '1.58',
    max_drawdown: '8.20%',
    profit_factor: '1.42',
    avg_holding_bars: '6',
  },
  equity_curve: [
    { timestamp: '2026-03-01T00:00:00Z', equity: 100000 },
    { timestamp: '2026-03-02T00:00:00Z', equity: 101000 },
  ],
  trades: [
    {
      id: '1',
      entry_time: '2026-03-01T00:00:00Z',
      exit_time: '2026-03-02T00:00:00Z',
      side: 'long',
      qty: 10,
      entry_price: 100,
      exit_price: 101,
      pnl: 10,
      pnl_pct: 1,
    },
  ],
};

describe('BacktestPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }));
  });

  it('renders the backtest header', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Backtest')).toBeInTheDocument();
  });

  it('shows strategy selector', () => {
    render(<BacktestPage />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('shows Run Backtest button', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Run Backtest')).toBeInTheDocument();
  });

  it('runs backtest and shows results from engine', async () => {
    render(<BacktestPage />);
    fireEvent.click(screen.getByText('Run Backtest'));

    await waitFor(() => {
      expect(screen.getByText('Total Return')).toBeInTheDocument();
    });

    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
  });

  it('shows engine error explanation and no results when engine fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Engine offline')));
    render(<BacktestPage />);
    fireEvent.click(screen.getByText('Run Backtest'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/No results were generated/)).toBeInTheDocument();
    expect(screen.queryByText('Total Return')).not.toBeInTheDocument();
  });
});
