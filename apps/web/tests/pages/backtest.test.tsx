import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BacktestPage from '@/app/(dashboard)/backtest/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/backtest',
  useRouter: () => ({ push: vi.fn() }),
}));

describe('BacktestPage', () => {
  it('renders the backtest header', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Backtest')).toBeInTheDocument();
  });

  it('shows strategy selector', () => {
    render(<BacktestPage />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('shows trend selection buttons', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Up')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.getByText('Volatile')).toBeInTheDocument();
    expect(screen.getByText('Random')).toBeInTheDocument();
  });

  it('shows Run Backtest button', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Run Backtest')).toBeInTheDocument();
  });

  it('shows empty state before running', () => {
    render(<BacktestPage />);
    expect(screen.getByText(/Configure a strategy and click/)).toBeInTheDocument();
  });

  it('runs backtest and shows results', async () => {
    render(<BacktestPage />);
    const runButton = screen.getByText('Run Backtest');
    fireEvent.click(runButton);

    await waitFor(
      () => {
        expect(screen.getByText('Total Return')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
  });

  it('allows switching trend options', () => {
    render(<BacktestPage />);
    const downButton = screen.getByText('Down');
    fireEvent.click(downButton);
    // The button should now have the active style class
    expect(downButton.className).toContain('text-primary');
  });

  // ── DataProvenance integration (T-B04) ──

  it('renders DataProvenance badge in header', () => {
    render(<BacktestPage />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
  });

  it('shows Simulated badge after fallback run', async () => {
    render(<BacktestPage />);
    fireEvent.click(screen.getByText('Run Backtest'));

    await waitFor(
      () => {
        expect(screen.getByText('Total Return')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Engine is not available in test, so results come from synthetic fallback
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Simulated'));
  });

  it('shows engine error explanation when engine fails', async () => {
    render(<BacktestPage />);
    fireEvent.click(screen.getByText('Run Backtest'));

    await waitFor(
      () => {
        expect(screen.getByText('Total Return')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Engine unavailable/);
    expect(alert).toHaveTextContent(/client-side simulation/);
  });
});
