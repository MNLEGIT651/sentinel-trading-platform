import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import StrategiesPage from '@/app/(dashboard)/strategies/page';
import { useAppStore } from '@/stores/app-store';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/strategies',
  useRouter: () => ({ push: vi.fn() }),
}));

const mockEngineResponse = {
  strategies: [
    {
      name: 'sma_crossover',
      family: 'trend_following',
      description: 'SMA crossover strategy.',
      default_params: { fast_period: 20, slow_period: 50 },
    },
    {
      name: 'rsi_momentum',
      family: 'momentum',
      description: 'RSI momentum strategy.',
      default_params: { rsi_period: 14 },
    },
  ],
  families: ['trend_following', 'momentum'],
  total: 2,
};

describe('StrategiesPage — live data', () => {
  beforeEach(() => {
    useAppStore.setState({ engineOnline: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockEngineResponse,
      }),
    );
  });

  it('renders page header', async () => {
    renderWithProviders(<StrategiesPage />);
    await waitFor(() => expect(screen.getByText('Strategies')).toBeInTheDocument());
  });

  it('shows live strategy names after fetch', async () => {
    renderWithProviders(<StrategiesPage />);
    await waitFor(() => expect(screen.getByText('Sma Crossover')).toBeInTheDocument());
  });

  it('shows family groups from live data', async () => {
    renderWithProviders(<StrategiesPage />);
    await waitFor(() => expect(screen.getByText('Trend Following')).toBeInTheDocument());
  });
});

describe('StrategiesPage — engine offline fallback', () => {
  beforeEach(() => {
    useAppStore.setState({ engineOnline: true });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });

  it('falls back to hardcoded data when engine is offline', async () => {
    renderWithProviders(<StrategiesPage />);
    await waitFor(() => expect(screen.getByText('SMA Crossover')).toBeInTheDocument());
  });
});
