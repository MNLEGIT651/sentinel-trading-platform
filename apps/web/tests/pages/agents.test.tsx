import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import AgentsPage from '@/app/(dashboard)/agents/page';
import { useAppStore } from '@/stores/app-store';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/agents',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/agents-client', () => ({
  agentsClient: {
    getStatus: vi.fn(),
    getRecommendations: vi.fn(),
    getAlerts: vi.fn(),
    runCycle: vi.fn(),
    halt: vi.fn(),
    resume: vi.fn(),
    approveRecommendation: vi.fn(),
    rejectRecommendation: vi.fn(),
  },
}));

const mockStatus = {
  agents: {
    market_sentinel: { status: 'idle' as const, lastRun: null },
    strategy_analyst: { status: 'idle' as const, lastRun: null },
    risk_monitor: { status: 'idle' as const, lastRun: null },
    research: { status: 'idle' as const, lastRun: null },
    execution_monitor: { status: 'idle' as const, lastRun: null },
  },
  cycleCount: 7,
  halted: false,
  isRunning: false,
  nextCycleAt: '2026-03-15T14:00:00.000Z',
  lastCycleAt: null,
};

const mockRec = {
  id: 'rec-1',
  created_at: new Date().toISOString(),
  agent_role: 'execution_monitor',
  ticker: 'NVDA',
  side: 'buy' as const,
  quantity: 5,
  order_type: 'market' as const,
  reason: 'RSI oversold crossover',
  strategy_name: 'rsi_momentum',
  signal_strength: 0.82,
  status: 'pending' as const,
  order_id: null,
};

describe('AgentsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAppStore.setState({ agentsOnline: true });
    const { agentsClient } = await import('@/lib/agents-client');
    vi.mocked(agentsClient.getStatus).mockResolvedValue(mockStatus);
    vi.mocked(agentsClient.getRecommendations).mockResolvedValue({ recommendations: [mockRec] });
    vi.mocked(agentsClient.getAlerts).mockResolvedValue({ alerts: [] });
    vi.mocked(agentsClient.runCycle).mockResolvedValue(undefined);
    vi.mocked(agentsClient.halt).mockResolvedValue(undefined);
    vi.mocked(agentsClient.resume).mockResolvedValue(undefined);
    vi.mocked(agentsClient.approveRecommendation).mockResolvedValue({
      orderId: 'alpaca-1',
      status: 'filled',
      fill_price: 880,
    });
    vi.mocked(agentsClient.rejectRecommendation).mockResolvedValue({ status: 'rejected' });
  });

  it('renders page header', async () => {
    renderWithProviders(<AgentsPage />);
    await waitFor(() => expect(screen.getByText('AI Agents')).toBeInTheDocument());
  });

  it('renders all 5 agent cards', async () => {
    renderWithProviders(<AgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Market Sentinel')).toBeInTheDocument();
      expect(screen.getByText('Strategy Analyst')).toBeInTheDocument();
      expect(screen.getByText('Risk Monitor')).toBeInTheDocument();
    });
  });

  it('shows cycle count from server status', async () => {
    renderWithProviders(<AgentsPage />);
    await waitFor(() => expect(screen.getByText(/7 cycles/i)).toBeInTheDocument());
  });

  it('renders pending recommendation with ticker', async () => {
    renderWithProviders(<AgentsPage />);
    await waitFor(() => expect(screen.getByText('NVDA')).toBeInTheDocument());
    expect(screen.getByText(/RSI oversold/i)).toBeInTheDocument();
  });

  it('clicking Approve opens review dialog, confirm calls approveRecommendation', async () => {
    const { agentsClient } = await import('@/lib/agents-client');

    // Mock the risk preview fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          recommendation: {
            id: 'rec-1',
            ticker: 'NVDA',
            side: 'buy',
            quantity: 5,
            order_type: 'market',
          },
          impacts: [
            { metric: 'Position Size', current: 0, projected: 2.5, limit: 5, unit: '%' },
            { metric: 'Open Positions', current: 3, projected: 4, limit: 20, unit: '' },
          ],
          limits: {
            max_position_pct: 5,
            max_sector_pct: 20,
            max_open_positions: 20,
            daily_loss_limit_pct: 2,
            soft_drawdown_pct: 10,
            hard_drawdown_pct: 15,
          },
          portfolio: { equity: 100000, cash: 50000, positions_count: 3, engine_connected: true },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    renderWithProviders(<AgentsPage />);
    await waitFor(() => screen.getByText('NVDA'));

    // Click "Review & Approve" to open the dialog
    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    // Wait for risk preview to load and the dialog "Approve Trade" button to appear
    await waitFor(() => screen.getByRole('button', { name: /approve trade/i }));

    // Confirm the approval
    fireEvent.click(screen.getByRole('button', { name: /approve trade/i }));
    await waitFor(() => expect(agentsClient.approveRecommendation).toHaveBeenCalledWith('rec-1'));

    vi.unstubAllGlobals();
  });

  it('clicking Reject calls rejectRecommendation', async () => {
    const { agentsClient } = await import('@/lib/agents-client');
    renderWithProviders(<AgentsPage />);
    await waitFor(() => screen.getByText('NVDA'));
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    await waitFor(() =>
      expect(agentsClient.rejectRecommendation).toHaveBeenCalledWith('rec-1', undefined),
    );
  });

  it('shows Scheduled badge', async () => {
    renderWithProviders(<AgentsPage />);
    await waitFor(() => expect(screen.getByText(/scheduled/i)).toBeInTheDocument());
  });

  it('clicking Run Cycle calls runCycle', async () => {
    const { agentsClient } = await import('@/lib/agents-client');
    renderWithProviders(<AgentsPage />);
    await waitFor(() => screen.getByRole('button', { name: /run cycle/i }));
    fireEvent.click(screen.getByRole('button', { name: /run cycle/i }));
    await waitFor(() => expect(agentsClient.runCycle).toHaveBeenCalled());
  });

  it('shows agents server offline state gracefully', async () => {
    const { agentsClient } = await import('@/lib/agents-client');
    vi.mocked(agentsClient.getStatus).mockRejectedValue(new Error('fetch failed'));
    vi.mocked(agentsClient.getRecommendations).mockRejectedValue(new Error('fetch failed'));
    vi.mocked(agentsClient.getAlerts).mockRejectedValue(new Error('fetch failed'));
    renderWithProviders(<AgentsPage />);
    await waitFor(() => expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0));
  });

  it('shows error banner when status query fails but agents are marked online', async () => {
    const { agentsClient } = await import('@/lib/agents-client');
    // agents service is reachable (online=true) but the status call errors
    vi.mocked(agentsClient.getStatus).mockRejectedValue(new Error('500 Internal Server Error'));
    // recommendations and alerts succeed with empty data
    vi.mocked(agentsClient.getRecommendations).mockResolvedValue({ recommendations: [] });
    vi.mocked(agentsClient.getAlerts).mockResolvedValue({ alerts: [] });
    renderWithProviders(<AgentsPage />);
    await waitFor(() =>
      expect(screen.getByText(/unable to load agent status/i)).toBeInTheDocument(),
    );
  });
});
