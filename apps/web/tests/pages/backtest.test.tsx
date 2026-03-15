import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BacktestPage from '@/app/backtest/page';

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
});
