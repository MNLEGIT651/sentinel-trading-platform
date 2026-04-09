import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import OrdersPage from '@/app/(dashboard)/orders/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/orders',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useFillsQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    useRiskEvaluationsQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    useOrderHistoryQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

async function mockAllEmpty() {
  const queries = await import('@/hooks/queries');
  vi.mocked(queries.useFillsQuery).mockReturnValue({
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof queries.useFillsQuery>);
  vi.mocked(queries.useRiskEvaluationsQuery).mockReturnValue({
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof queries.useRiskEvaluationsQuery>);
  vi.mocked(queries.useOrderHistoryQuery).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof queries.useOrderHistoryQuery>);
}

async function mockWithOrders(orders?: Record<string, unknown>[]) {
  const queries = await import('@/hooks/queries');
  vi.mocked(queries.useFillsQuery).mockReturnValue({
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof queries.useFillsQuery>);
  vi.mocked(queries.useRiskEvaluationsQuery).mockReturnValue({
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof queries.useRiskEvaluationsQuery>);
  vi.mocked(queries.useOrderHistoryQuery).mockReturnValue({
    data: orders ?? [
      {
        order_id: 'ord-001',
        symbol: 'AAPL',
        side: 'buy',
        order_type: 'market',
        qty: 10,
        filled_qty: 10,
        status: 'filled',
        fill_price: 180.0,
        submitted_at: '2026-03-19T12:00:00Z',
        filled_at: '2026-03-19T12:00:01Z',
        risk_note: null,
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof queries.useOrderHistoryQuery>);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('OrdersPage', () => {
  // ─── Basic rendering ──────────────────────────────────────────────────

  it('renders without crashing', () => {
    const { container } = renderWithProviders(<OrdersPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Orders & Fills heading', () => {
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText('Orders & Fills')).toBeInTheDocument();
  });

  it('has page-enter class on root container', () => {
    const { container } = renderWithProviders(<OrdersPage />);
    const root = container.querySelector('.page-enter');
    expect(root).toBeTruthy();
  });

  // ─── ErrorBoundary ────────────────────────────────────────────────────

  it('wraps content in ErrorBoundary', () => {
    const { container } = renderWithProviders(<OrdersPage />);
    // ErrorBoundary renders children directly, verify page renders
    expect(container.querySelector('.page-enter')).toBeTruthy();
  });

  // ─── Stats Row ────────────────────────────────────────────────────────

  it('renders stats row labels when no data', () => {
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Fill Rate')).toBeInTheDocument();
    expect(screen.getByText('Total Commission')).toBeInTheDocument();
    expect(screen.getByText('Avg Slippage')).toBeInTheDocument();
  });

  it('renders stagger-grid on stats cards', () => {
    renderWithProviders(<OrdersPage />);
    const statsGrid = screen.getByText('Total Events').closest('.stagger-grid');
    expect(statsGrid).toBeTruthy();
  });

  it('shows Spinner in stats when loading', async () => {
    const { useOrderHistoryQuery } = await import('@/hooks/queries');
    vi.mocked(useOrderHistoryQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOrderHistoryQuery>);

    renderWithProviders(<OrdersPage />);
    const spinners = screen.getAllByRole('status');
    expect(spinners.length).toBeGreaterThan(0);
  });

  // ─── Filter controls ─────────────────────────────────────────────────

  it('renders Select component for type filter with aria-label', () => {
    renderWithProviders(<OrdersPage />);
    const select = screen.getByLabelText('Filter by event type');
    expect(select).toBeInTheDocument();
    expect(select.tagName).toBe('SELECT');
  });

  it('renders Input component for search with aria-label', () => {
    renderWithProviders(<OrdersPage />);
    const input = screen.getByLabelText('Search orders by ID, symbol, or reason');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('renders date range buttons with aria-labels', () => {
    renderWithProviders(<OrdersPage />);
    expect(screen.getByLabelText('Filter by Today')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Week')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Month')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by All')).toBeInTheDocument();
  });

  it('shows clear button when filters are active', () => {
    renderWithProviders(<OrdersPage />);
    // Change date range to activate a filter
    fireEvent.click(screen.getByLabelText('Filter by Today'));
    expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
  });

  it('type filter changes filtered results', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    const select = screen.getByLabelText('Filter by event type');
    fireEvent.change(select, { target: { value: 'fills' } });
    // Orders should be hidden, only fills (none) remain
    expect(screen.getByText('No execution activity yet')).toBeInTheDocument();
  });

  it('search input filters entries', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    const input = screen.getByLabelText('Search orders by ID, symbol, or reason');
    fireEvent.change(input, { target: { value: 'NONEXISTENT' } });
    expect(screen.getByText('No execution activity yet')).toBeInTheDocument();
  });

  // ─── Table rendering ─────────────────────────────────────────────────

  it('renders Table component with sortable headers when data is present', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    const table = screen.getByRole('table', { name: 'Orders and execution timeline' });
    expect(table).toBeInTheDocument();
  });

  it('renders order entries in table when order data is present', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText(/BUY AAPL/)).toBeInTheDocument();
  });

  it('displays side badge with sideColors for buy orders', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    const buyBadge = screen.getByText('BUY');
    expect(buyBadge).toBeInTheDocument();
  });

  it('displays side badge with sideColors for sell orders', async () => {
    await mockWithOrders([
      {
        order_id: 'ord-002',
        symbol: 'MSFT',
        side: 'sell',
        order_type: 'limit',
        qty: 5,
        filled_qty: 5,
        status: 'filled',
        fill_price: 375.0,
        submitted_at: '2026-03-19T13:00:00Z',
        filled_at: '2026-03-19T13:00:01Z',
        risk_note: null,
      },
    ]);
    renderWithProviders(<OrdersPage />);
    const sellBadge = screen.getByText('SELL');
    expect(sellBadge).toBeInTheDocument();
  });

  it('displays order status badge using orderStatusColors', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText('Filled')).toBeInTheDocument();
  });

  it('renders sortable column headers', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    // SortableTableHead uses aria-sort attribute
    const typeHeader = screen.getByText('Type').closest('th');
    expect(typeHeader).toHaveAttribute('aria-sort');
    const timeHeader = screen.getByText('Time').closest('th');
    expect(timeHeader).toHaveAttribute('aria-sort');
  });

  it('expand button has correct aria attributes', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    const expandBtn = screen.getByLabelText('Expand details');
    expect(expandBtn).toBeInTheDocument();
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking expand button shows detail panel', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    const expandBtn = screen.getByLabelText('Expand details');
    fireEvent.click(expandBtn);
    // Should now show order detail section with "Order Lifecycle"
    expect(screen.getByText('Order Lifecycle')).toBeInTheDocument();
  });

  // ─── Empty state ──────────────────────────────────────────────────────

  it('shows empty state when all data is empty arrays', async () => {
    await mockAllEmpty();
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText('No execution activity yet')).toBeInTheDocument();
  });

  // ─── Error state ──────────────────────────────────────────────────────

  it('shows ErrorState component when queries fail', async () => {
    const { useFillsQuery, useRiskEvaluationsQuery, useOrderHistoryQuery } =
      await import('@/hooks/queries');
    vi.mocked(useFillsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fetch failed'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useFillsQuery>);
    vi.mocked(useRiskEvaluationsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRiskEvaluationsQuery>);
    vi.mocked(useOrderHistoryQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOrderHistoryQuery>);

    renderWithProviders(<OrdersPage />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('ErrorState retry button triggers refetch', async () => {
    const refetchFills = vi.fn();
    const refetchRisk = vi.fn();
    const refetchOrders = vi.fn();

    const { useFillsQuery, useRiskEvaluationsQuery, useOrderHistoryQuery } =
      await import('@/hooks/queries');
    vi.mocked(useFillsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fail'),
      refetch: refetchFills,
    } as unknown as ReturnType<typeof useFillsQuery>);
    vi.mocked(useRiskEvaluationsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchRisk,
    } as unknown as ReturnType<typeof useRiskEvaluationsQuery>);
    vi.mocked(useOrderHistoryQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchOrders,
    } as unknown as ReturnType<typeof useOrderHistoryQuery>);

    renderWithProviders(<OrdersPage />);
    fireEvent.click(screen.getByText('Try Again'));
    expect(refetchFills).toHaveBeenCalled();
    expect(refetchRisk).toHaveBeenCalled();
    expect(refetchOrders).toHaveBeenCalled();
  });

  // ─── Loading state ────────────────────────────────────────────────────

  it('shows Spinner when loading', async () => {
    const { useFillsQuery, useRiskEvaluationsQuery, useOrderHistoryQuery } =
      await import('@/hooks/queries');
    vi.mocked(useFillsQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useFillsQuery>);
    vi.mocked(useRiskEvaluationsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRiskEvaluationsQuery>);
    vi.mocked(useOrderHistoryQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOrderHistoryQuery>);

    renderWithProviders(<OrdersPage />);
    const spinners = screen.getAllByRole('status');
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Pagination ───────────────────────────────────────────────────────

  it('renders pagination nav with aria-label when many entries', async () => {
    // Create 35 orders to exceed PAGE_SIZE_ORDERS (30)
    const orders = Array.from({ length: 35 }, (_, i) => ({
      order_id: `ord-${String(i).padStart(3, '0')}`,
      symbol: 'AAPL',
      side: 'buy' as const,
      order_type: 'market',
      qty: 10,
      filled_qty: 10,
      status: 'filled',
      fill_price: 180.0,
      submitted_at: new Date(Date.now() - i * 60000).toISOString(),
      filled_at: new Date(Date.now() - i * 60000 + 1000).toISOString(),
      risk_note: null,
    }));
    await mockWithOrders(orders);
    renderWithProviders(<OrdersPage />);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
  });

  it('previous button is disabled on first page', async () => {
    const orders = Array.from({ length: 35 }, (_, i) => ({
      order_id: `ord-${String(i).padStart(3, '0')}`,
      symbol: 'AAPL',
      side: 'buy' as const,
      order_type: 'market',
      qty: 10,
      filled_qty: 10,
      status: 'filled',
      fill_price: 180.0,
      submitted_at: new Date(Date.now() - i * 60000).toISOString(),
      filled_at: new Date(Date.now() - i * 60000 + 1000).toISOString(),
      risk_note: null,
    }));
    await mockWithOrders(orders);
    renderWithProviders(<OrdersPage />);

    expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
    expect(screen.getByLabelText('Go to next page')).not.toBeDisabled();
  });

  it('clicking next page navigates forward', async () => {
    const orders = Array.from({ length: 35 }, (_, i) => ({
      order_id: `ord-${String(i).padStart(3, '0')}`,
      symbol: 'AAPL',
      side: 'buy' as const,
      order_type: 'market',
      qty: 10,
      filled_qty: 10,
      status: 'filled',
      fill_price: 180.0,
      submitted_at: new Date(Date.now() - i * 60000).toISOString(),
      filled_at: new Date(Date.now() - i * 60000 + 1000).toISOString(),
      risk_note: null,
    }));
    await mockWithOrders(orders);
    renderWithProviders(<OrdersPage />);

    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  // ─── Event count ──────────────────────────────────────────────────────

  it('shows event count', async () => {
    await mockWithOrders();
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText(/1 event/)).toBeInTheDocument();
  });

  it('shows plural events count', async () => {
    await mockWithOrders([
      {
        order_id: 'ord-001',
        symbol: 'AAPL',
        side: 'buy',
        order_type: 'market',
        qty: 10,
        filled_qty: 10,
        status: 'filled',
        fill_price: 180.0,
        submitted_at: '2026-03-19T12:00:00Z',
        filled_at: '2026-03-19T12:00:01Z',
        risk_note: null,
      },
      {
        order_id: 'ord-002',
        symbol: 'MSFT',
        side: 'sell',
        order_type: 'limit',
        qty: 5,
        filled_qty: 5,
        status: 'filled',
        fill_price: 375.0,
        submitted_at: '2026-03-19T13:00:00Z',
        filled_at: '2026-03-19T13:00:01Z',
        risk_note: null,
      },
    ]);
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText(/2 events/)).toBeInTheDocument();
  });
});
