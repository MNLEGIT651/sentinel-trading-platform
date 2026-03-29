import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import CatalystsPage from '@/app/(dashboard)/catalysts/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/catalysts',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useCatalystsQuery: vi.fn(() => ({
      data: undefined,
      isLoading: false,
      error: null,
    })),
    useCreateCatalystMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    })),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('CatalystsPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<CatalystsPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Catalyst Overlay heading', () => {
    renderWithProviders(<CatalystsPage />);
    expect(screen.getByText('Catalyst Overlay')).toBeInTheDocument();
  });

  it('renders date range inputs', () => {
    renderWithProviders(<CatalystsPage />);
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the Add Event button', () => {
    renderWithProviders(<CatalystsPage />);
    expect(screen.getByText('Add Event')).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
    renderWithProviders(<CatalystsPage />);
    expect(screen.getByText(/No catalyst events/i)).toBeInTheDocument();
  });
});
