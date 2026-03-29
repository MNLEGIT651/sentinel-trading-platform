import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ExperimentDetailPage from '@/app/(dashboard)/experiment/[id]/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/experiment/test-exp-1',
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'test-exp-1' }),
}));

vi.mock('@/components/ui/collapsible-card', () => ({
  CollapsibleCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="collapsible-card">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/info-tooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <span data-testid="info-tooltip" title={content} />
  ),
}));

const mockReport = {
  experiment: {
    id: 'test-exp-1',
    name: 'Test Experiment Alpha',
    description: 'A test experiment',
    status: 'completed',
    halted: false,
    halt_reason: null,
    week1_start: '2024-01-01',
    week1_end: '2024-01-07',
    week2_start: '2024-01-08',
    week2_end: '2024-01-14',
    max_daily_trades: 10,
    max_position_value: 5000,
    signal_strength_threshold: 0.6,
    max_total_exposure: 50000,
    initial_capital: 100000,
    verdict: null,
    verdict_reason: null,
    final_metrics: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  snapshots: [],
  orders: [],
  summary: {
    total_orders: 0,
    filled_orders: 0,
    shadow_orders: 0,
    total_pnl: 0,
    total_return_pct: 0,
    max_drawdown_pct: 0,
    avg_sharpe: null,
    avg_win_rate: null,
  },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('ExperimentDetailPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ExperimentDetailPage />);
    expect(container).toBeTruthy();
  });

  it('shows loading state initially', () => {
    renderWithProviders(<ExperimentDetailPage />);
    // Component starts in loading state with a spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    renderWithProviders(<ExperimentDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load experiment report')).toBeInTheDocument();
    });
  });

  it('shows experiment name when data loads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockReport,
      }),
    );

    renderWithProviders(<ExperimentDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Test Experiment Alpha')).toBeInTheDocument();
    });
  });
});
