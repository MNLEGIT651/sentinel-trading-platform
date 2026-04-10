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

  it('shows Offline provenance badge when engine is offline with no cached data', async () => {
    useAppStore.setState({ engineOnline: false });
    global.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response)) as typeof fetch;
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Offline'));
    });
  });

  it('shows mode-appropriate empty state when offline', async () => {
    useAppStore.setState({ engineOnline: false });
    global.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response)) as typeof fetch;
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText(/engine is offline/)).toBeInTheDocument();
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

  it('surfaces meaningful error message on submit failure', async () => {
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
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      if (urlStr.endsWith('/portfolio/orders') && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          json: () => Promise.resolve({ error: 'Insufficient buying power' }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'TSLA' } });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText(/Order failed/)).toBeInTheDocument();
    });
  });

  it('displays risk-block reason for concentration limit', async () => {
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
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      if (urlStr.endsWith('/portfolio/orders') && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          json: () =>
            Promise.resolve({
              error: 'Concentration limit exceeded',
              reason: 'concentration_limit',
            }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'AAPL' } });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText(/concentration limit/i)).toBeInTheDocument();
    });
  });

  it('displays server error guidance for 503', async () => {
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
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      if (urlStr.endsWith('/portfolio/orders') && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: () => Promise.resolve({ error: 'Engine unavailable' }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'AAPL' } });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(
      () => {
        expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
      },
      { timeout: 3_000 },
    );
  });

  it('displays network error guidance on fetch failure', async () => {
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
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      if (urlStr.endsWith('/portfolio/orders') && init?.method === 'POST') {
        return Promise.reject(new Error('Failed to fetch'));
      }
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'AAPL' } });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(
      () => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      },
      { timeout: 3_000 },
    );
  });

  it('handles rejected order status with meaningful message', async () => {
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
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      if (urlStr.endsWith('/portfolio/orders') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ order_id: 'rej-1', status: 'rejected' }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'TSLA' } });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText(/Rejected/)).toBeInTheDocument();
    });
  });

  it('sends order_type and time_in_force in submit payload', async () => {
    let capturedBody: Record<string, unknown> | null = null;

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
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      if (urlStr.endsWith('/portfolio/orders') && init?.method === 'POST') {
        capturedBody = JSON.parse(init?.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ order_id: 'ord-tif', status: 'filled' }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Quick Order')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Limit order'));
    const tifSelect = screen.getByLabelText('Time in Force') as HTMLSelectElement;
    fireEvent.change(tifSelect, { target: { value: 'gtc' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Limit Price')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'AAPL' } });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '150.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    expect(capturedBody).toMatchObject({
      symbol: 'AAPL',
      side: 'buy',
      qty: 10,
      type: 'limit',
      time_in_force: 'gtc',
      limit_price: 150.5,
    });
  });

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

  // ─── Design System Polish Tests ────────────────────────────────────

  it('uses Table compound component with aria-label for positions', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Open positions' })).toBeInTheDocument();
    });
  });

  it('uses Table compound component with aria-label for recent orders', async () => {
    const filledOrder = {
      order_id: 'ord-tbl',
      symbol: 'AAPL',
      side: 'buy',
      order_type: 'market',
      qty: 1,
      filled_qty: 1,
      status: 'filled',
      fill_price: 250.0,
      submitted_at: '2026-03-15T10:00:00Z',
      filled_at: '2026-03-15T10:00:01Z',
      risk_note: null,
    };

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/portfolio/account'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccount) } as Response);
      if (urlStr.includes('/portfolio/positions'))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPositions),
        } as Response);
      if (urlStr.includes('/data/quotes'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQuotes) } as Response);
      if (urlStr.includes('/portfolio/orders/history'))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([filledOrder]),
        } as Response);
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;

    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Recent orders' })).toBeInTheDocument();
    });
  });

  it('has aria-label on Refresh button', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh portfolio data' })).toBeInTheDocument();
    });
  });

  it('has aria-pressed attributes on Buy/Sell toggle buttons', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      const buyBtn = screen.getByRole('button', { name: 'Buy' });
      expect(buyBtn).toHaveAttribute('aria-pressed', 'true');
      const sellBtn = screen.getByRole('button', { name: 'Sell' });
      expect(sellBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('renders stagger-grid class on snapshot metrics grid', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    });
    const portfolioValueCard = screen.getByText('Portfolio Value').closest('.stagger-grid');
    expect(portfolioValueCard).toBeTruthy();
  });

  it('renders page-enter class on root container', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio')).toBeInTheDocument();
    });
    const heading = screen.getByText('Portfolio');
    const rootContainer = heading.closest('.page-enter');
    expect(rootContainer).toBeTruthy();
  });

  it('uses LoadingButton for order submission', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      const submitBtn = screen.getByRole('button', { name: 'Submit' });
      expect(submitBtn).toBeInTheDocument();
      expect(submitBtn).toHaveAttribute('data-slot', 'button');
    });
  });

  it('uses Input components with data-slot in Quick Order form', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      const symbolInput = screen.getByPlaceholderText('Symbol');
      expect(symbolInput).toHaveAttribute('data-slot', 'input');
      const qtyInput = screen.getByPlaceholderText('Qty');
      expect(qtyInput).toHaveAttribute('data-slot', 'input');
    });
  });

  it('uses Select component with data-slot for Time in Force', async () => {
    renderWithProviders(<PortfolioPage />);
    await waitFor(() => {
      const tifSelect = screen.getByLabelText('Time in Force');
      expect(tifSelect.closest('[data-slot="select"]')).toBeTruthy();
    });
  });
});
