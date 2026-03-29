import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import RolesPage from '@/app/(dashboard)/roles/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/roles',
  useRouter: () => ({ push: vi.fn() }),
}));

const mockMutation = vi.hoisted(() => ({
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
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useMyProfileQuery: vi.fn().mockReturnValue({
      data: {
        profile: {
          id: 'user-1',
          display_name: 'Test User',
          role: 'operator' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    }),
    useRolesQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    }),
    useUpdateRoleMutation: vi.fn().mockReturnValue(mockMutation),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('OperatorRolesPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<RolesPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Operator Roles heading', () => {
    renderWithProviders(<RolesPage />);
    expect(screen.getByText('Operator Roles')).toBeInTheDocument();
  });

  it('renders the permissions matrix', () => {
    renderWithProviders(<RolesPage />);
    expect(screen.getByText('Permission Matrix')).toBeInTheDocument();
    expect(screen.getByText('View dashboards & data')).toBeInTheDocument();
  });

  it('shows empty team members message when no profiles', async () => {
    const { useRolesQuery } = await import('@/hooks/queries');
    vi.mocked(useRolesQuery).mockReturnValue({
      data: { profiles: [], history: [], currentUserId: 'user-1' },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRolesQuery>);

    renderWithProviders(<RolesPage />);
    expect(screen.getByText(/no team members found/i)).toBeInTheDocument();
  });

  it('renders team member cards when profiles are present', async () => {
    const { useRolesQuery } = await import('@/hooks/queries');
    vi.mocked(useRolesQuery).mockReturnValue({
      data: {
        profiles: [
          {
            id: 'user-1',
            display_name: 'Alice Operator',
            role: 'operator' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'user-2',
            display_name: 'Bob Reviewer',
            role: 'reviewer' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        history: [],
        currentUserId: 'user-1',
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRolesQuery>);

    renderWithProviders(<RolesPage />);
    expect(screen.getByText('Alice Operator')).toBeInTheDocument();
    expect(screen.getByText('Bob Reviewer')).toBeInTheDocument();
  });

  it('shows your role summary section', () => {
    renderWithProviders(<RolesPage />);
    expect(screen.getByText(/Your Role:/i)).toBeInTheDocument();
  });
});
