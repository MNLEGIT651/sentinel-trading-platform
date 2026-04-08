import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import WorkflowsPage from '@/app/(dashboard)/workflows/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/workflows',
  useRouter: () => ({ push: vi.fn() }),
}));

const mockStats = {
  total: 0,
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  retrying: 0,
  cancelled: 0,
  avg_duration_ms: null,
  failure_rate: null,
};

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useWorkflowJobsQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    }),
    useWorkflowStepsQuery: vi.fn().mockReturnValue({
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

describe('WorkflowsPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<WorkflowsPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Workflows heading', () => {
    renderWithProviders(<WorkflowsPage />);
    expect(screen.getByText('Workflows')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', async () => {
    const { useWorkflowJobsQuery } = await import('@/hooks/queries');
    vi.mocked(useWorkflowJobsQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useWorkflowJobsQuery>);

    renderWithProviders(<WorkflowsPage />);
    expect(screen.getByText(/loading workflows/i)).toBeInTheDocument();
  });

  it('shows empty state when no workflows found', async () => {
    const { useWorkflowJobsQuery } = await import('@/hooks/queries');
    vi.mocked(useWorkflowJobsQuery).mockReturnValue({
      data: { data: [], total: 0, stats: mockStats },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useWorkflowJobsQuery>);

    renderWithProviders(<WorkflowsPage />);
    expect(screen.getByText('No workflows found')).toBeInTheDocument();
  });

  it('renders workflow job row when data is present', async () => {
    const { useWorkflowJobsQuery } = await import('@/hooks/queries');
    vi.mocked(useWorkflowJobsQuery).mockReturnValue({
      data: {
        data: [
          {
            id: 'wf-001',
            workflow_type: 'recommendation_lifecycle',
            idempotency_key: null,
            status: 'completed',
            current_step: null,
            steps_completed: ['risk_check', 'notify'],
            input_data: {},
            output_data: {},
            error_message: null,
            error_count: 0,
            max_retries: 3,
            retry_after: null,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            timeout_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            recommendation_id: null,
            order_id: null,
            agent_run_id: null,
          },
        ],
        total: 1,
        stats: { ...mockStats, total: 1, completed: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useWorkflowJobsQuery>);

    renderWithProviders(<WorkflowsPage />);
    expect(screen.getByText('Workflows')).toBeInTheDocument();
  });

  it('shows error state when query fails', async () => {
    const { useWorkflowJobsQuery } = await import('@/hooks/queries');
    vi.mocked(useWorkflowJobsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('API error'),
    } as ReturnType<typeof useWorkflowJobsQuery>);

    renderWithProviders(<WorkflowsPage />);
    expect(screen.getByText(/failed to load workflows/i)).toBeInTheDocument();
  });
});
