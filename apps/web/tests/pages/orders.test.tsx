import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
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
    }),
    useRiskEvaluationsQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    }),
    useOrderHistoryQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    }),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('OrdersPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<OrdersPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Orders & Fills heading', () => {
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText('Orders & Fills')).toBeInTheDocument();
  });

  it('renders stats row labels when no data', () => {
    renderWithProviders(<OrdersPage />);
    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Fill Rate')).toBeInTheDocument();
  });

  it('renders order entries when order data is present', async () => {
    const { useOrderHistoryQuery } = await import('@/hooks/queries');
    vi.mocked(useOrderHistoryQuery).mockReturnValue({
      data: [
        {
          order_id: 'ord-001',
          symbol: 'AAPL',
          side: 'buy',
          order_type: 'market',
          qty: 10,
          filled_qty: 10,
          status: 'filled',
          fill_price: 180.0,
          submitted_at: new Date().toISOString(),
          filled_at: new Date().toISOString(),
          risk_note: null,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOrderHistoryQuery>);

    renderWithProviders(<OrdersPage />);
    expect(screen.getByText(/BUY AAPL/)).toBeInTheDocument();
  });

  it('shows empty timeline when all data is empty arrays', async () => {
    const { useFillsQuery, useRiskEvaluationsQuery, useOrderHistoryQuery } =
      await import('@/hooks/queries');
    vi.mocked(useFillsQuery).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useFillsQuery>);
    vi.mocked(useRiskEvaluationsQuery).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRiskEvaluationsQuery>);
    vi.mocked(useOrderHistoryQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOrderHistoryQuery>);

    renderWithProviders(<OrdersPage />);
    expect(screen.getByText('Orders & Fills')).toBeInTheDocument();
  });
});
