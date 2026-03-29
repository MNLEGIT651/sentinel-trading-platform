import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import CounterfactualsPage from '@/app/(dashboard)/counterfactuals/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/counterfactuals',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useCounterfactualsQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('CounterfactualsPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<CounterfactualsPage />);
    expect(container).toBeTruthy();
  });

  it('renders the page heading', () => {
    renderWithProviders(<CounterfactualsPage />);
    expect(screen.getByText('Counterfactuals')).toBeInTheDocument();
  });

  it('shows empty state when no counterfactuals', () => {
    renderWithProviders(<CounterfactualsPage />);
    expect(
      screen.getByText('No rejected or risk-blocked recommendations yet.'),
    ).toBeInTheDocument();
  });
});
