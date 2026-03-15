import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StrategiesPage from '@/app/strategies/page';

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockEngineResponse,
      }),
    );
  });

  it('renders page header', () => {
    render(<StrategiesPage />);
    expect(screen.getByText('Strategies')).toBeInTheDocument();
  });

  it('shows live strategy names after fetch', async () => {
    render(<StrategiesPage />);
    await waitFor(() => expect(screen.getByText('Sma Crossover')).toBeInTheDocument());
  });

  it('shows family groups from live data', async () => {
    render(<StrategiesPage />);
    await waitFor(() => expect(screen.getByText('Trend Following')).toBeInTheDocument());
  });
});

describe('StrategiesPage — engine offline fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });

  it('falls back to hardcoded data when engine is offline', async () => {
    render(<StrategiesPage />);
    await waitFor(() => expect(screen.getByText('SMA Crossover')).toBeInTheDocument());
  });
});
