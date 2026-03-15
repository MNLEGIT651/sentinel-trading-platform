import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AgentsPage from '@/app/agents/page';

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
    market_sentinel: { status: 'idle', lastRun: null },
    strategy_analyst: { status: 'idle', lastRun: null },
    risk_monitor: { status: 'idle', lastRun: null },
    research: { status: 'idle', lastRun: null },
    execution_monitor: { status: 'idle', lastRun: null },
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
    const { agentsClient } = await import('@/lib/agents-client');
    vi.mocked(agentsClient.getStatus).mockResolvedValue(mockStatus);
    vi.mocked(agentsClient.getRecommendations).mockResolvedValue({ recommendations: [mockRec] });
    vi.mocked(agentsClient.getAlerts).mockResolvedValue({ alerts: [] });
    vi.mocked(agentsClient.runCycle).mockResolvedValue(undefined);
    vi.mocked(agentsClient.halt).mockResolvedValue(undefined);
    vi.mocked(agentsClient.resume).mockResolvedValue(undefined);
    vi.mocked(agentsClient.approveRecommendation).mockResolvedValue({ orderId: 'alpaca-1', status: 'filled', fill_price: 880 });
    vi.mocked(agentsClient.rejectRecommendation).mockResolvedValue({ status: 'rejected' });
  });

  it('renders page header', async () => {
    render(<AgentsPage />);
    expect(screen.getByText('AI Agents')).toBeInTheDocument();
  });

  it('renders all 5 agent cards', async () => {
    render(<AgentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Market Sentinel')).toBeInTheDocument();
      expect(screen.getByText('Strategy Analyst')).toBeInTheDocument();
      expect(screen.getByText('Risk Monitor')).toBeInTheDocument();
    });
  });

  it('shows cycle count from server status', async () => {
    render(<AgentsPage />);
    await waitFor(() => expect(screen.getByText(/7 cycles/i)).toBeInTheDocument());
  });

  it('renders pending recommendation with ticker', async () => {
    render(<AgentsPage />);
    await waitFor(() => expect(screen.getByText('NVDA')).toBeInTheDocument());
    expect(screen.getByText(/RSI oversold/i)).toBeInTheDocument();
  });

  it('clicking Approve calls approveRecommendation', async () => {
    const { agentsClient } = await import('@/lib/agents-client');
    render(<AgentsPage />);
    await waitFor(() => screen.getByText('NVDA'));
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => expect(agentsClient.approveRecommendation).toHaveBeenCalledWith('rec-1'));
  });

  it('clicking Reject calls rejectRecommendation', async () => {
    const { agentsClient } = await import('@/lib/agents-client');
    render(<AgentsPage />);
    await waitFor(() => screen.getByText('NVDA'));
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    await waitFor(() => expect(agentsClient.rejectRecommendation).toHaveBeenCalledWith('rec-1'));
  });

  it('shows Scheduled badge', async () => {
    render(<AgentsPage />);
    await waitFor(() => expect(screen.getByText(/scheduled/i)).toBeInTheDocument());
  });

  it('clicking Run Cycle calls runCycle', async () => {
    const { agentsClient } = await import('@/lib/agents-client');
    render(<AgentsPage />);
    await waitFor(() => screen.getByRole('button', { name: /run cycle/i }));
    fireEvent.click(screen.getByRole('button', { name: /run cycle/i }));
    await waitFor(() => expect(agentsClient.runCycle).toHaveBeenCalled());
  });

  it('shows agents server offline state gracefully', async () => {
    const { agentsClient } = await import('@/lib/agents-client');
    vi.mocked(agentsClient.getStatus).mockRejectedValue(new Error('fetch failed'));
    vi.mocked(agentsClient.getRecommendations).mockRejectedValue(new Error('fetch failed'));
    vi.mocked(agentsClient.getAlerts).mockRejectedValue(new Error('fetch failed'));
    render(<AgentsPage />);
    await waitFor(() => expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0));
  });
});
