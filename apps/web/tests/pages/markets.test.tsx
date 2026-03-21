import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MarketsPage from '@/app/markets/page';
import { useAppStore } from '@/stores/app-store';

vi.mock('next/navigation', () => ({
  usePathname: () => '/markets',
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock PriceChart since lightweight-charts needs real canvas/DOM
vi.mock('@/components/charts/price-chart', () => ({
  PriceChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="price-chart">Chart: {data.length} bars</div>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock fetch to simulate engine responses
const mockQuotes = [
  {
    ticker: 'AAPL',
    open: 175.0,
    high: 180.0,
    low: 174.5,
    close: 178.72,
    volume: 50000000,
    vwap: 177.5,
    timestamp: '2026-03-14T20:00:00',
    change: 3.72,
    change_pct: 2.13,
  },
  {
    ticker: 'MSFT',
    open: 375.0,
    high: 380.0,
    low: 374.0,
    close: 378.91,
    volume: 30000000,
    vwap: 377.0,
    timestamp: '2026-03-14T20:00:00',
    change: 3.91,
    change_pct: 1.04,
  },
  {
    ticker: 'GOOGL',
    open: 140.0,
    high: 143.0,
    low: 139.0,
    close: 141.8,
    volume: 25000000,
    vwap: 141.0,
    timestamp: '2026-03-14T20:00:00',
    change: 1.8,
    change_pct: 1.29,
  },
  {
    ticker: 'AMZN',
    open: 176.0,
    high: 180.0,
    low: 175.0,
    close: 178.25,
    volume: 35000000,
    vwap: 177.5,
    timestamp: '2026-03-14T20:00:00',
    change: 2.25,
    change_pct: 1.28,
  },
  {
    ticker: 'NVDA',
    open: 490.0,
    high: 498.0,
    low: 489.0,
    close: 495.22,
    volume: 60000000,
    vwap: 494.0,
    timestamp: '2026-03-14T20:00:00',
    change: 5.22,
    change_pct: 1.07,
  },
  {
    ticker: 'TSLA',
    open: 252.0,
    high: 253.0,
    low: 246.0,
    close: 248.48,
    volume: 80000000,
    vwap: 249.0,
    timestamp: '2026-03-14T20:00:00',
    change: -3.52,
    change_pct: -1.4,
  },
  {
    ticker: 'META',
    open: 354.0,
    high: 358.0,
    low: 353.0,
    close: 355.64,
    volume: 20000000,
    vwap: 355.0,
    timestamp: '2026-03-14T20:00:00',
    change: 1.64,
    change_pct: 0.46,
  },
  {
    ticker: 'JPM',
    open: 171.0,
    high: 174.0,
    low: 170.0,
    close: 172.96,
    volume: 15000000,
    vwap: 172.0,
    timestamp: '2026-03-14T20:00:00',
    change: 1.96,
    change_pct: 1.15,
  },
  {
    ticker: 'V',
    open: 260.0,
    high: 263.0,
    low: 259.0,
    close: 261.53,
    volume: 10000000,
    vwap: 261.0,
    timestamp: '2026-03-14T20:00:00',
    change: 1.53,
    change_pct: 0.59,
  },
  {
    ticker: 'SPY',
    open: 455.0,
    high: 458.0,
    low: 454.0,
    close: 456.38,
    volume: 90000000,
    vwap: 456.0,
    timestamp: '2026-03-14T20:00:00',
    change: 1.38,
    change_pct: 0.3,
  },
];

const mockBars = [
  {
    timestamp: '2026-03-10T00:00:00',
    open: 170.0,
    high: 175.0,
    low: 169.0,
    close: 174.5,
    volume: 40000000,
    vwap: 172.0,
  },
  {
    timestamp: '2026-03-11T00:00:00',
    open: 174.5,
    high: 178.0,
    low: 173.0,
    close: 177.2,
    volume: 42000000,
    vwap: 175.5,
  },
  {
    timestamp: '2026-03-12T00:00:00',
    open: 177.2,
    high: 180.0,
    low: 176.0,
    close: 178.72,
    volume: 45000000,
    vwap: 178.0,
  },
];

describe('MarketsPage', () => {
  beforeEach(() => {
    useAppStore.setState({ engineOnline: false });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the watchlist panel', async () => {
    render(<MarketsPage />);
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
  });

  it('shows all 10 tickers', async () => {
    render(<MarketsPage />);
    // AAPL appears in watchlist + chart header, so use getAllByText
    expect(screen.getAllByText('AAPL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText('META')).toBeInTheDocument();
    expect(screen.getByText('JPM')).toBeInTheDocument();
    expect(screen.getByText('V')).toBeInTheDocument();
    expect(screen.getByText('SPY')).toBeInTheDocument();
    expect(screen.getByText('AMZN')).toBeInTheDocument();
  });

  it('displays company names', async () => {
    render(<MarketsPage />);
    // Apple Inc. appears in watchlist + chart header (AAPL selected by default)
    expect(screen.getAllByText('Apple Inc.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Microsoft Corp.')).toBeInTheDocument();
    expect(screen.getByText('NVIDIA Corp.')).toBeInTheDocument();
  });

  it('shows the selected ticker in the chart header', async () => {
    render(<MarketsPage />);
    // AAPL is selected by default — appears in both watchlist and chart header
    const aaplElements = screen.getAllByText('AAPL');
    expect(aaplElements.length).toBeGreaterThanOrEqual(2);
  });

  it('switches ticker when watchlist item is clicked', async () => {
    render(<MarketsPage />);
    await waitFor(() => {
      expect(screen.getByText('NVDA')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('NVIDIA Corp.'));
    // NVDA should now appear in the chart header too
    const nvdaElements = screen.getAllByText('NVDA');
    expect(nvdaElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows Offline badge when engine is unavailable', async () => {
    render(<MarketsPage />);
    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  it('shows Live badge when engine returns quotes', async () => {
    useAppStore.setState({ engineOnline: true });
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuotes,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockBars,
      });

    render(<MarketsPage />);
    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  it('shows real prices when engine returns quotes', async () => {
    useAppStore.setState({ engineOnline: true });
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuotes,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockBars,
      });

    render(<MarketsPage />);
    // $178.72 appears in both watchlist and chart header for AAPL
    await waitFor(() => {
      expect(screen.getAllByText('$178.72').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('$378.91')).toBeInTheDocument();
  });

  it('shows fallback prices when engine is offline', async () => {
    render(<MarketsPage />);
    await waitFor(() => {
      expect(screen.getAllByText('$178.72').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the PriceChart component with bar data', async () => {
    useAppStore.setState({ engineOnline: true });
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuotes,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockBars,
      });

    render(<MarketsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('price-chart')).toBeInTheDocument();
    });
    expect(screen.getByText(/Chart: 3 bars/)).toBeInTheDocument();
  });
});
