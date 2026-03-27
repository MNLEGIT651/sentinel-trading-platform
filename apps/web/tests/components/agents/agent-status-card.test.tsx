import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentStatusCard } from '@/components/agents/agent-status-card';
import { Bot } from 'lucide-react';

describe('AgentStatusCard', () => {
  it('renders agent name', () => {
    render(
      <AgentStatusCard
        agentRole="market_analyst"
        name="Market Analyst"
        description="Analyzes market conditions and trends."
        icon={Bot}
        color="text-blue-400"
        badgeClass="bg-blue-500/15 text-blue-400 border-blue-500/30"
        isOffline={false}
      />,
    );
    expect(screen.getByText('Market Analyst')).toBeInTheDocument();
  });

  it('renders agent role badge', () => {
    render(
      <AgentStatusCard
        agentRole="market_analyst"
        name="Market Analyst"
        description="Analyzes market conditions and trends."
        icon={Bot}
        color="text-blue-400"
        badgeClass="bg-blue-500/15 text-blue-400 border-blue-500/30"
        isOffline={false}
      />,
    );
    expect(screen.getByText('market analyst')).toBeInTheDocument();
  });
});
