import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import PortfolioPage from '@/app/(dashboard)/portfolio/page';
import { useAppStore } from '@/stores/app-store';
import { renderWithProviders } from '../test-utils';

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
  {
    ticker: 'AAPL',
    close: 252.0,
    change_pct: 0.8,
    open: 250,
    high: 253,
    low: 249,
    volume: 1000000,
    vwap: 251,
    timestamp: '2026-03-15',
    change: 2,
  },
  {
    ticker: 'MSFT',
    close: 398.0,
    change_pct: 0.76,
    open: 395,
    high: 399,
    low: 394,
    volume: 800000,
    vwap: 397,
    timestamp: '2026-03-15',
    change: 3,
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
  useAppStore.setState({ engineOnline: true });
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
    if (urlStr.includes('/portfolio/orders/history')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    }
    return Promise.resolve({ ok: false } as Response);
  }) as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PortfolioPage', () => {
  it('renders the portfolio header', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });
  });

  it('displays position count from engine', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 positions/)).toBeInTheDocument();
    });
  });

  it('renders summary metric cards', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
      expect(screen.getByText('Unrealized P&L')).toBeInTheDocument();
      expect(screen.getByText('Cash Balance')).toBeInTheDocument();
    });
  });

  it('renders position tickers from broker', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('MSFT')).toBeInTheDocument();
    });
  });

  it('shows tab navigation with Positions, Allocation, Risk', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Allocation' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Risk' })).toBeInTheDocument();
    });
  });

  it('shows Live provenance badge when engine is connected', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Live'));
    });
  });

  it('shows Simulated provenance badge when engine is offline with no cached data', async () => {
    useAppStore.setState({ engineOnline: false });
    global.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response)) as typeof fetch;
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Simulated'));
    });
  });

  it('shows mode-appropriate empty state when offline', async () => {
    useAppStore.setState({ engineOnline: false });
    global.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response)) as typeof fetch;
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText(/simulated portfolio/)).toBeInTheDocument();
    });
  });

  it('renders the Quick Order panel', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
      expect(screen.getByText('Buy')).toBeInTheDocument();
      expect(screen.getByText('Sell')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });
  });

  it('renders the Refresh button', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('polls an accepted order until it is filled', async () => {
    const filledOrder = {
      order_id: 'ord-123',
      symbol: 'AAPL',
      side: 'buy',
      order_type: 'market',
      qty: 3,
      filled_qty: 3,
      status: 'filled',
      fill_price: 251.23,
      submitted_at: '2026-03-15T10:00:00Z',
      filled_at: '2026-03-15T10:00:02Z',
      risk_note: null,
    };

    global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/portfolio/account')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccount) } as Response);
      }
      if (urlStr.includes('/portfolio/positions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPositions),
        } as Response);
      }
      if (urlStr.includes('/data/quotes')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQuotes) } as Response);
      }
      if (urlStr.includes('/portfolio/orders/history')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([filledOrder]),
        } as Response);
      }
      if (urlStr.endsWith('/portfolio/orders') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              order_id: 'ord-123',
              status: 'accepted',
              fill_price: null,
              fill_quantity: null,
              commission: 0,
              slippage: null,
            }),
        } as Response);
      }
      if (urlStr.includes('/portfolio/orders/ord-123')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              order_id: 'ord-123',
              symbol: 'AAPL',
              side: 'buy',
              status: 'filled',
              fill_price: 251.23,
              filled_qty: 3,
              submitted_at: '2026-03-15T10:00:00Z',
            }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    renderWithProviders(<PortfolioPage />);

    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'aapl' } });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('Order accepted')).toBeInTheDocument();
    });

    // After polling completes, the filled order appears in the RecentOrders table
    await waitFor(
      () => {
        expect(screen.getByText('$251.23')).toBeInTheDocument();
      },
      { timeout: 4_000 },
    );
  }, 10_000);

  it('shows empty state when no positions from engine (live mode)', async () => {
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

    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText(/No open positions/)).toBeInTheDocument();
    });
  });
});
