import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskSummary, type RiskSummaryProps } from '@/components/portfolio/risk-summary';

// Mock @sentinel/shared
vi.mock('@sentinel/shared', () => ({
  DEFAULT_TRADING_POLICY: {
    max_position_pct: 5,
    max_sector_pct: 20,
    daily_loss_limit_pct: 2,
    soft_drawdown_pct: 10,
    hard_drawdown_pct: 15,
    max_open_positions: 20,
    paper_trading: true,
    auto_trading: false,
    require_confirmation: true,
  },
}));

const baseProps: RiskSummaryProps = {
  positions: [],
  portfolioTotal: 100_000,
  totalValue: 0,
  totalCost: 0,
  totalPnlPct: 0,
  allocations: [],
};

const mkPosition = (
  ticker: string,
  name: string,
  shares: number,
  avgEntry: number,
  currentPrice: number,
  sector = 'Technology',
) => ({
  ticker,
  name,
  shares,
  avgEntry,
  currentPrice,
  sector,
});

const diversifiedPositions = [
  mkPosition('AAPL', 'Apple Inc.', 10, 150, 160, 'Technology'),
  mkPosition('MSFT', 'Microsoft Corp', 8, 300, 310, 'Technology'),
  mkPosition('JNJ', 'Johnson & Johnson', 15, 160, 165, 'Healthcare'),
  mkPosition('JPM', 'JPMorgan Chase', 12, 140, 145, 'Financials'),
];

describe('RiskSummary', () => {
  // ── Empty / No-data state ──────────────────────────────────────────

  it('renders empty state when no positions', () => {
    render(<RiskSummary {...baseProps} />);
    expect(screen.getByText(/no positions to analyze/i)).toBeInTheDocument();
  });

  it('does not render risk-summary container when no positions', () => {
    render(<RiskSummary {...baseProps} />);
    expect(screen.queryByTestId('risk-summary')).not.toBeInTheDocument();
  });

  // ── Normal rendering with positions ────────────────────────────────

  it('renders risk summary container with positions', () => {
    const totalValue = diversifiedPositions.reduce((s, p) => s + p.shares * p.currentPrice, 0);
    render(
      <RiskSummary
        {...baseProps}
        positions={diversifiedPositions}
        totalValue={totalValue}
        portfolioTotal={100_000}
        totalCost={totalValue - 500}
        allocations={[
          { label: 'Technology', pct: 45, color: 'bg-blue-500' },
          { label: 'Healthcare', pct: 30, color: 'bg-green-500' },
          { label: 'Financials', pct: 25, color: 'bg-amber-500' },
        ]}
      />,
    );
    expect(screen.getByTestId('risk-summary')).toBeInTheDocument();
  });

  it('displays overall risk level badge', () => {
    const totalValue = diversifiedPositions.reduce((s, p) => s + p.shares * p.currentPrice, 0);
    render(
      <RiskSummary
        {...baseProps}
        positions={diversifiedPositions}
        totalValue={totalValue}
        portfolioTotal={100_000}
        allocations={[
          { label: 'Technology', pct: 45, color: 'bg-blue-500' },
          { label: 'Healthcare', pct: 30, color: 'bg-green-500' },
        ]}
      />,
    );
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Overall risk level'));
  });

  it('shows position concentration with tickers', () => {
    const totalValue = diversifiedPositions.reduce((s, p) => s + p.shares * p.currentPrice, 0);
    render(
      <RiskSummary
        {...baseProps}
        positions={diversifiedPositions}
        totalValue={totalValue}
        portfolioTotal={100_000}
        allocations={[]}
      />,
    );
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('JNJ')).toBeInTheDocument();
    expect(screen.getByText('JPM')).toBeInTheDocument();
  });

  it('renders risk metric rows', () => {
    const totalValue = diversifiedPositions.reduce((s, p) => s + p.shares * p.currentPrice, 0);
    render(
      <RiskSummary
        {...baseProps}
        positions={diversifiedPositions}
        totalValue={totalValue}
        portfolioTotal={100_000}
        allocations={[{ label: 'Technology', pct: 45, color: 'bg-blue-500' }]}
      />,
    );
    expect(screen.getByText('Largest Position')).toBeInTheDocument();
    expect(screen.getByText('Largest Sector')).toBeInTheDocument();
    expect(screen.getByText('Drawdown Exposure')).toBeInTheDocument();
    expect(screen.getByText('Open Positions')).toBeInTheDocument();
  });

  // ── Warning states ─────────────────────────────────────────────────

  it('shows "All positions within policy limits" when no warnings', () => {
    const smallPositions = [
      mkPosition('AAPL', 'Apple Inc.', 1, 150, 160, 'Technology'),
      mkPosition('JNJ', 'J&J', 1, 160, 165, 'Healthcare'),
    ];
    const totalValue = smallPositions.reduce((s, p) => s + p.shares * p.currentPrice, 0);
    render(
      <RiskSummary
        {...baseProps}
        positions={smallPositions}
        totalValue={totalValue}
        portfolioTotal={100_000}
        allocations={[
          { label: 'Technology', pct: 0.2, color: 'bg-blue-500' },
          { label: 'Healthcare', pct: 0.2, color: 'bg-green-500' },
        ]}
      />,
    );
    expect(screen.getByText(/all positions within policy limits/i)).toBeInTheDocument();
  });

  it('shows critical warning when position exceeds limit', () => {
    // One position that is > 5% of portfolio
    const bigPosition = [mkPosition('AAPL', 'Apple Inc.', 100, 150, 160)];
    const totalValue = 100 * 160; // 16000
    render(
      <RiskSummary
        {...baseProps}
        positions={bigPosition}
        totalValue={totalValue}
        portfolioTotal={20_000} // AAPL = 16000/20000 = 80%
        allocations={[{ label: 'Technology', pct: 80, color: 'bg-blue-500' }]}
      />,
    );
    expect(screen.getByText(/AAPL is 80\.0% of portfolio/i)).toBeInTheDocument();
  });

  it('shows sector limit warning when sector exceeds limit', () => {
    const positions = [mkPosition('AAPL', 'Apple Inc.', 10, 150, 160)];
    const totalValue = 10 * 160;
    render(
      <RiskSummary
        {...baseProps}
        positions={positions}
        totalValue={totalValue}
        portfolioTotal={totalValue * 2}
        allocations={[{ label: 'Technology', pct: 25, color: 'bg-blue-500' }]}
      />,
    );
    expect(screen.getByText(/technology sector is 25\.0% of portfolio/i)).toBeInTheDocument();
  });

  it('shows drawdown warning when P&L exceeds daily loss limit', () => {
    const positions = [mkPosition('AAPL', 'Apple Inc.', 10, 150, 140)];
    const totalValue = 10 * 140;
    render(
      <RiskSummary
        {...baseProps}
        positions={positions}
        totalValue={totalValue}
        portfolioTotal={100_000}
        totalCost={10 * 150}
        totalPnlPct={-5.0}
        allocations={[{ label: 'Technology', pct: 1, color: 'bg-blue-500' }]}
      />,
    );
    expect(
      screen.getByText(/portfolio drawdown at 5\.0% exceeds daily limit/i),
    ).toBeInTheDocument();
  });

  // ── Concentration display ──────────────────────────────────────────

  it('shows concentration percentages for each position', () => {
    const positions = [mkPosition('AAPL', 'Apple Inc.', 50, 100, 100)];
    const totalValue = 50 * 100;
    render(
      <RiskSummary
        {...baseProps}
        positions={positions}
        totalValue={totalValue}
        portfolioTotal={10_000} // 5000/10000 = 50%
        allocations={[]}
      />,
    );
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  // ── Risk level derivation ──────────────────────────────────────────

  it('shows "Low" risk level for small safe positions', () => {
    const positions = [mkPosition('AAPL', 'Apple Inc.', 1, 150, 155)];
    const totalValue = 1 * 155;
    render(
      <RiskSummary
        {...baseProps}
        positions={positions}
        totalValue={totalValue}
        portfolioTotal={100_000}
        allocations={[{ label: 'Technology', pct: 0.2, color: 'bg-blue-500' }]}
      />,
    );
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('Low');
  });

  it('shows "High" risk level when metrics exceed limits', () => {
    const positions = [mkPosition('AAPL', 'Apple Inc.', 100, 150, 160)];
    const totalValue = 100 * 160;
    render(
      <RiskSummary
        {...baseProps}
        positions={positions}
        totalValue={totalValue}
        portfolioTotal={totalValue} // 100% in one position
        allocations={[{ label: 'Technology', pct: 100, color: 'bg-blue-500' }]}
      />,
    );
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('High');
  });

  // ── Section headers ────────────────────────────────────────────────

  it('renders section headers for all cards', () => {
    const totalValue = diversifiedPositions.reduce((s, p) => s + p.shares * p.currentPrice, 0);
    render(
      <RiskSummary
        {...baseProps}
        positions={diversifiedPositions}
        totalValue={totalValue}
        portfolioTotal={100_000}
        allocations={[]}
      />,
    );
    expect(screen.getByText('Overall Risk Level')).toBeInTheDocument();
    expect(screen.getByText('Sizing Alerts')).toBeInTheDocument();
    expect(screen.getByText('Position Concentration')).toBeInTheDocument();
  });
});
