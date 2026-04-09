import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import SystemControlsPage from '@/app/(dashboard)/system-controls/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/system-controls',
  useRouter: () => ({ push: vi.fn() }),
}));

const { mockMutation, mockControls } = vi.hoisted(() => ({
  mockMutation: {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    variables: undefined,
    reset: vi.fn(),
    status: 'idle' as const,
    isIdle: true,
    submittedAt: 0,
    failureCount: 0,
    failureReason: null,
    context: undefined,
  },
  mockControls: {
    id: 'controls-1',
    trading_halted: false,
    live_execution_enabled: false,
    global_mode: 'paper' as const,
    max_daily_trades: 10,
    autonomy_mode: 'supervised' as const,
    previous_autonomy_mode: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
  },
}));

vi.mock('@/hooks/queries/use-system-controls-query', () => ({
  useSystemControlsQuery: vi.fn().mockReturnValue({
    data: mockControls,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useUpdateSystemControlsMutation: vi.fn().mockReturnValue(mockMutation),
  useHaltSystemMutation: vi.fn().mockReturnValue(mockMutation),
  useResumeSystemMutation: vi.fn().mockReturnValue(mockMutation),
}));

vi.mock('@/hooks/queries/use-operator-actions-query', () => ({
  useOperatorActionsQuery: vi.fn().mockReturnValue({
    data: { data: [], total: 0, limit: 10, offset: 0 },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useRecordActionMutation: vi.fn().mockReturnValue(mockMutation),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('SystemControlsPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<SystemControlsPage />);
    expect(container).toBeTruthy();
  });

  it('renders the System Controls heading', () => {
    renderWithProviders(<SystemControlsPage />);
    expect(screen.getByText('System Controls')).toBeInTheDocument();
  });

  it('shows trading status card', () => {
    renderWithProviders(<SystemControlsPage />);
    expect(screen.getByText('Trading Status')).toBeInTheDocument();
  });

  it('shows global mode card', () => {
    renderWithProviders(<SystemControlsPage />);
    expect(screen.getByText('Global Mode')).toBeInTheDocument();
  });

  it('shows Active status when trading is not halted', () => {
    renderWithProviders(<SystemControlsPage />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Halted status when trading is halted', async () => {
    const { useSystemControlsQuery } = await import('@/hooks/queries/use-system-controls-query');
    vi.mocked(useSystemControlsQuery).mockReturnValue({
      data: { ...mockControls, trading_halted: true },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useSystemControlsQuery>);

    renderWithProviders(<SystemControlsPage />);
    expect(screen.getByText('Halted')).toBeInTheDocument();
  });

  it('shows loading state while fetching controls', async () => {
    const { useSystemControlsQuery } = await import('@/hooks/queries/use-system-controls-query');
    vi.mocked(useSystemControlsQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useSystemControlsQuery>);

    renderWithProviders(<SystemControlsPage />);
    expect(screen.getByText(/loading system controls/i)).toBeInTheDocument();
  });

  it('shows error state when controls fail to load', async () => {
    const { useSystemControlsQuery } = await import('@/hooks/queries/use-system-controls-query');
    vi.mocked(useSystemControlsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to connect'),
    } as ReturnType<typeof useSystemControlsQuery>);

    renderWithProviders(<SystemControlsPage />);
    expect(screen.getByText(/failed to load system controls/i)).toBeInTheDocument();
  });
});
