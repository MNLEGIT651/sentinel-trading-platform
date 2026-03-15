import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PortfolioPage from '@/app/portfolio/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/portfolio',
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock engine API responses
const mockAccount = {
  cash: 95000,
  positions_value: 5000,
  equity: 100000,
  initial_capital: 100000,
};

const mockPositions = [
  { instrument_id: 'AAPL', quantity: 10, avg_price: 250.0 },
  { instrument_id: 'MSFT', quantity: 5, avg_price: 395.0 },
];

const mockQuotes = [
  { ticker: 'AAPL', close: 252.0, change_pct: 0.8, open: 250, high: 253, low: 249, volume: 1000000, vwap: 251, timestamp: '2026-03-15', change: 2 },
  { ticker: 'MSFT', close: 398.0, change_pct: 0.76, open: 395, high: 399, low: 394, volume: 800000, vwap: 397, timestamp: '2026-03-15', change: 3 },
];

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn((url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/portfolio/account')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccount) } as Response);
    }
    if (urlStr.includes('/portfolio/positions')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPositions) } as Response);
    }
    if (urlStr.includes('/data/quotes')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQuotes) } as Response);
    }
    return Promise.resolve({ ok: false } as Response);
  }) as typeof fetch;
});

describe('PortfolioPage', () => {
  it('renders the portfolio header', async () => {
    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });
  });

  it('displays position count from engine', async () => {
    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 positions/)).toBeInTheDocument();
    });
  });

  it('renders summary metric cards', async () => {
    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
      expect(screen.getByText('Unrealized P&L')).toBeInTheDocument();
      expect(screen.getByText('Cash Balance')).toBeInTheDocument();
    });
  });

  it('renders position tickers from broker', async () => {
    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('MSFT')).toBeInTheDocument();
    });
  });

  it('shows tab navigation with Positions, Allocation, Risk', async () => {
    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Allocation' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Risk' })).toBeInTheDocument();
    });
  });

  it('shows Live indicator when engine is connected', async () => {
    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  it('renders the Quick Order panel', async () => {
    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
      expect(screen.getByText('Buy')).toBeInTheDocument();
      expect(screen.getByText('Sell')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });
  });

  it('renders the Refresh button', async () => {
    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('shows empty state when no positions from engine', async () => {
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/portfolio/account')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccount) } as Response);
      }
      if (urlStr.includes('/portfolio/positions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    render(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('No open positions')).toBeInTheDocument();
    });
  });
});
