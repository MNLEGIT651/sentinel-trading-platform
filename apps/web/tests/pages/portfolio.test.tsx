import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortfolioPage from '@/app/portfolio/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/portfolio',
  useRouter: () => ({ push: vi.fn() }),
}));

describe('PortfolioPage', () => {
  it('renders the portfolio header', () => {
    render(<PortfolioPage />);
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('displays position count', () => {
    render(<PortfolioPage />);
    expect(screen.getByText(/8 positions/)).toBeInTheDocument();
  });

  it('renders summary metric cards', () => {
    render(<PortfolioPage />);
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Unrealized P&L')).toBeInTheDocument();
    expect(screen.getByText('Cash Balance')).toBeInTheDocument();
    // "Positions" appears as both a metric card and a tab, so check for at least one
    expect(screen.getAllByText('Positions').length).toBeGreaterThanOrEqual(1);
  });

  it('renders all position tickers in the table', () => {
    render(<PortfolioPage />);
    const tickers = ['AAPL', 'MSFT', 'NVDA', 'JPM', 'V', 'AMZN', 'META', 'SPY'];
    for (const ticker of tickers) {
      expect(screen.getByText(ticker)).toBeInTheDocument();
    }
  });

  it('shows tab navigation with Positions, Allocation, Risk', () => {
    render(<PortfolioPage />);
    expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Allocation' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Risk' })).toBeInTheDocument();
  });

  it('displays sector badges for positions', () => {
    render(<PortfolioPage />);
    expect(screen.getAllByText('Technology').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Financials').length).toBeGreaterThanOrEqual(1);
  });
});
