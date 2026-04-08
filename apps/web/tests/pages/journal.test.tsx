import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import JournalPage from '@/app/(dashboard)/journal/page';
import { renderWithProviders } from '../test-utils';
import type { JournalEntry } from '@sentinel/shared';

vi.mock('next/navigation', () => ({
  usePathname: () => '/journal',
  useRouter: () => ({ push: vi.fn() }),
}));

interface JournalResponse {
  entries: JournalEntry[];
  total: number;
  limit: number;
  offset: number;
}

const mockUseJournalQuery = vi.fn(() => ({
  data: undefined as JournalResponse | undefined,
  isLoading: false,
  isError: false,
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useJournalQuery: () => mockUseJournalQuery(),
    useJournalStatsQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
    useGradeJournalMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  mockUseJournalQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    user_id: '11111111-2222-3333-4444-555555555555',
    event_type: 'fill',
    ticker: 'AAPL',
    direction: 'long',
    quantity: 100,
    price: 150.0,
    agent_name: null,
    reasoning: null,
    confidence: 0.85,
    strategy_name: 'momentum',
    market_regime: null,
    vix_at_time: null,
    sector: null,
    recommendation_id: null,
    order_id: null,
    signal_id: null,
    user_notes: null,
    user_grade: null,
    outcome_pnl: null,
    outcome_return_pct: null,
    outcome_hold_minutes: null,
    metadata: {},
    created_at: new Date().toISOString(),
    graded_at: null,
    ...overrides,
  };
}

describe('JournalPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<JournalPage />);
    expect(container).toBeTruthy();
  });

  it('renders the page heading', () => {
    renderWithProviders(<JournalPage />);
    expect(screen.getByText('Decision Journal')).toBeInTheDocument();
  });

  it('shows empty state when no journal entries', () => {
    renderWithProviders(<JournalPage />);
    expect(screen.getByText('No journal entries yet')).toBeInTheDocument();
  });

  it('renders entry with order_id link badge', () => {
    const entry = makeEntry({
      order_id: '66666666-7777-8888-9999-aaaaaaaaaaaa',
    });
    mockUseJournalQuery.mockReturnValue({
      data: { entries: [entry], total: 1, limit: 25, offset: 0 },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<JournalPage />);
    const orderLink = screen.getByText('Order');
    expect(orderLink).toBeInTheDocument();
    expect(orderLink.closest('a')).toHaveAttribute(
      'href',
      '/orders/66666666-7777-8888-9999-aaaaaaaaaaaa',
    );
  });

  it('renders entry with recommendation_id "Why" link badge', () => {
    const entry = makeEntry({
      recommendation_id: '11111111-2222-3333-4444-555555555555',
    });
    mockUseJournalQuery.mockReturnValue({
      data: { entries: [entry], total: 1, limit: 25, offset: 0 },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<JournalPage />);
    const whyLink = screen.getByText('Why');
    expect(whyLink).toBeInTheDocument();
    expect(whyLink.closest('a')).toHaveAttribute(
      'href',
      '/recommendations/11111111-2222-3333-4444-555555555555',
    );
  });

  it('renders entry without linkage fields (backward compatible)', () => {
    const entry = makeEntry();
    mockUseJournalQuery.mockReturnValue({
      data: { entries: [entry], total: 1, limit: 25, offset: 0 },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<JournalPage />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('Order')).not.toBeInTheDocument();
    expect(screen.queryByText('Why')).not.toBeInTheDocument();
  });

  it('renders entry with both order and recommendation linkage', () => {
    const entry = makeEntry({
      order_id: '66666666-7777-8888-9999-aaaaaaaaaaaa',
      recommendation_id: '11111111-2222-3333-4444-555555555555',
    });
    mockUseJournalQuery.mockReturnValue({
      data: { entries: [entry], total: 1, limit: 25, offset: 0 },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<JournalPage />);
    expect(screen.getByText('Order')).toBeInTheDocument();
    expect(screen.getByText('Why')).toBeInTheDocument();
  });
});
