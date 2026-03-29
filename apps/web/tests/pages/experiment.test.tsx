import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ExperimentPage from '@/app/(dashboard)/experiment/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/experiment',
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('ExperimentPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<ExperimentPage />);
    expect(container).toBeTruthy();
  });

  it('renders the page heading after loading', async () => {
    renderWithProviders(<ExperimentPage />);
    await waitFor(() => {
      expect(screen.getByText('Paper Trading Experiment')).toBeInTheDocument();
    });
  });

  it('shows create experiment UI when no active experiment', async () => {
    renderWithProviders(<ExperimentPage />);
    await waitFor(() => {
      expect(screen.getByText('Start a New Experiment')).toBeInTheDocument();
    });
  });
});
