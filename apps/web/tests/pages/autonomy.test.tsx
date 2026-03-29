import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import AutonomyPage from '@/app/(dashboard)/autonomy/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/autonomy',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries/use-system-controls-query', () => ({
  useSystemControlsQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
  useUpdateSystemControlsMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useHaltSystemMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useResumeSystemMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/queries/use-strategies-autonomy-query', () => ({
  useStrategiesAutonomyQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
  useUpdateStrategyAutonomyMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/hooks/queries/use-universe-restrictions-query', () => ({
  useUniverseRestrictionsQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
  useCreateRestrictionMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteRestrictionMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/hooks/queries/use-auto-execution-activity-query', () => ({
  useAutoExecutionActivityQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('AutonomyPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<AutonomyPage />);
    expect(container).toBeTruthy();
  });

  it('renders the page heading', () => {
    renderWithProviders(<AutonomyPage />);
    expect(screen.getByText('Bounded Autonomy')).toBeInTheDocument();
  });

  it('shows empty strategies state when no strategies configured', () => {
    renderWithProviders(<AutonomyPage />);
    expect(screen.getByText('No strategies configured')).toBeInTheDocument();
  });

  it('shows system autonomy status card', () => {
    renderWithProviders(<AutonomyPage />);
    expect(screen.getByText('System Autonomy Status')).toBeInTheDocument();
  });
});
