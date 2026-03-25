import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SignalsPage from '@/app/(dashboard)/signals/page';
import { useAppStore } from '@/stores/app-store';

vi.mock('next/navigation', () => ({
  usePathname: () => '/signals',
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  useAppStore.setState({ engineOnline: true });
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

  it('caps live scans to 5 tickers and warns when a larger universe is entered', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<SignalsPage />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'AAPL,MSFT,GOOGL,AMZN,NVDA,TSLA' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Scan/i }));

    expect(await screen.findByText(/Only the first 5 tickers were scanned/i)).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { tickers: string[] };
    expect(body.tickers).toEqual(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA']);
  });

  it('shows a rate-limit aware timeout message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('signal timed out')));
    render(<SignalsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Run Scan/i }));

    expect(
      await screen.findByText(/Signal scan exceeded the live data time budget/i),
    ).toBeInTheDocument();
  });
});
