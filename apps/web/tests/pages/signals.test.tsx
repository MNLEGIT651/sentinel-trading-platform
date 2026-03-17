import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SignalsPage from '@/app/signals/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/signals',
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signals: [],
        total_signals: 0,
        tickers_scanned: 0,
        strategies_run: 0,
        errors: [],
      }),
    }),
  );
});

describe('SignalsPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<SignalsPage />);
    expect(container).toBeTruthy();
  });

  it('shows the Signals heading', () => {
    render(<SignalsPage />);
    expect(screen.getByText('Signals')).toBeInTheDocument();
  });

  it('shows Run Scan button', () => {
    render(<SignalsPage />);
    expect(screen.getByRole('button', { name: /Run Scan/i })).toBeInTheDocument();
  });
});
