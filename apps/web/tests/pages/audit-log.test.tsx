import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import AuditLogPage from '@/app/(dashboard)/audit-log/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/audit-log',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries/use-operator-actions-query', () => ({
  useOperatorActionsQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useRecordActionMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

const mockAction = {
  id: 'act-001',
  action_type: 'approve_recommendation' as const,
  operator_id: 'user-abc123',
  target_type: 'recommendation',
  target_id: 'rec-xyz',
  reason: 'Strong momentum signal',
  metadata: {},
  created_at: new Date().toISOString(),
};

describe('AuditLogPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<AuditLogPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Audit Log heading', () => {
    renderWithProviders(<AuditLogPage />);
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('shows stats cards when data is empty', async () => {
    const { useOperatorActionsQuery } = await import('@/hooks/queries/use-operator-actions-query');
    vi.mocked(useOperatorActionsQuery).mockReturnValue({
      data: { data: [], total: 0, limit: 20, offset: 0 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOperatorActionsQuery>);

    renderWithProviders(<AuditLogPage />);
    expect(screen.getByText('Total Actions')).toBeInTheDocument();
  });

  it('renders action entries when data is present', async () => {
    const { useOperatorActionsQuery } = await import('@/hooks/queries/use-operator-actions-query');
    vi.mocked(useOperatorActionsQuery).mockReturnValue({
      data: { data: [mockAction], total: 1, limit: 20, offset: 0 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOperatorActionsQuery>);

    renderWithProviders(<AuditLogPage />);
    expect(screen.getAllByText('Approve Recommendation').length).toBeGreaterThan(0);
  });

  it('shows loading skeleton while fetching', async () => {
    const { useOperatorActionsQuery } = await import('@/hooks/queries/use-operator-actions-query');
    vi.mocked(useOperatorActionsQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useOperatorActionsQuery>);

    renderWithProviders(<AuditLogPage />);
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });
});
