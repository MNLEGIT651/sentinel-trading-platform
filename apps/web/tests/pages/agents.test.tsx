import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AgentsPage from '@/app/agents/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/agents',
  useRouter: () => ({ push: vi.fn() }),
}));

describe('AgentsPage', () => {
  it('renders the agents header', () => {
    render(<AgentsPage />);
    expect(screen.getByText('AI Agents')).toBeInTheDocument();
  });

  it('displays all 5 agent cards', () => {
    render(<AgentsPage />);
    expect(screen.getByText('Market Sentinel')).toBeInTheDocument();
    expect(screen.getByText('Strategy Analyst')).toBeInTheDocument();
    expect(screen.getByText('Risk Monitor')).toBeInTheDocument();
    expect(screen.getByText('Research Analyst')).toBeInTheDocument();
    expect(screen.getByText('Execution Monitor')).toBeInTheDocument();
  });

  it('shows cycle count', () => {
    render(<AgentsPage />);
    expect(screen.getByText(/0 cycles completed/)).toBeInTheDocument();
  });

  it('shows Run Cycle and Halt buttons', () => {
    render(<AgentsPage />);
    expect(screen.getByText('Run Cycle')).toBeInTheDocument();
    expect(screen.getByText('Halt')).toBeInTheDocument();
  });

  it('displays agent tools', () => {
    render(<AgentsPage />);
    expect(screen.getAllByText('get_market_data').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('submit_order')).toBeInTheDocument();
    expect(screen.getByText('assess_portfolio_risk')).toBeInTheDocument();
  });

  it('all agents start as idle', () => {
    render(<AgentsPage />);
    const idleLabels = screen.getAllByText('Idle');
    expect(idleLabels).toHaveLength(5);
  });

  it('clicking Halt shows HALTED badge', () => {
    render(<AgentsPage />);
    fireEvent.click(screen.getByText('Halt'));
    expect(screen.getByText('HALTED')).toBeInTheDocument();
  });

  it('clicking Resume after halt removes HALTED badge', () => {
    render(<AgentsPage />);
    fireEvent.click(screen.getByText('Halt'));
    expect(screen.getByText('HALTED')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Resume'));
    expect(screen.queryByText('HALTED')).not.toBeInTheDocument();
  });

  it('shows empty activity log initially', () => {
    render(<AgentsPage />);
    expect(
      screen.getByText(/No activity yet/),
    ).toBeInTheDocument();
  });
});
