import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import DataQualityPage from '@/app/(dashboard)/data-quality/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/data-quality',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useDataQualityQuery: vi.fn(() => ({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    })),
    useResolveEventsMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('DataQualityPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<DataQualityPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Data Quality heading', () => {
    renderWithProviders(<DataQualityPage />);
    expect(screen.getByText('Data Quality')).toBeInTheDocument();
  });

  it('renders the stats grid with zero counts when no data', () => {
    renderWithProviders(<DataQualityPage />);
    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Unresolved')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
    renderWithProviders(<DataQualityPage />);
    expect(screen.getByText('No data quality issues')).toBeInTheDocument();
  });

  it('shows filter controls', () => {
    renderWithProviders(<DataQualityPage />);
    expect(screen.getByText('All Types')).toBeInTheDocument();
    expect(screen.getByText('All Severities')).toBeInTheDocument();
    expect(screen.getByText('Show Resolved')).toBeInTheDocument();
  });

  it('shows Refresh button', () => {
    renderWithProviders(<DataQualityPage />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });
});
