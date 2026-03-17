import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyCard } from '@/components/strategies/strategy-card';
import type { StrategyEntry } from '@/components/strategies/strategy-card';

const mockStrategy: StrategyEntry = {
  id: 'strat-1',
  name: 'SMA Crossover',
  description: 'A simple moving average crossover strategy.',
  version: '1.0.0',
  is_active: true,
  parameters: { fast: 10, slow: 50 },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('StrategyCard', () => {
  it('renders strategy name', () => {
    render(<StrategyCard strategy={mockStrategy} />);
    expect(screen.getByText('SMA Crossover')).toBeInTheDocument();
  });
});
