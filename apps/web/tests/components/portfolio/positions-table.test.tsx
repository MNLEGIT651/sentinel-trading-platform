import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PositionsTable } from '@/components/portfolio/positions-table';
import type { Position } from '@/components/portfolio/positions-table';

const mockPosition: Position = {
  ticker: 'AAPL',
  name: 'Apple Inc.',
  shares: 10,
  avgEntry: 150.0,
  currentPrice: 160.0,
  sector: 'Technology',
};

describe('PositionsTable', () => {
  it('renders a position row with ticker text', () => {
    render(
      <PositionsTable
        sortedPositions={[mockPosition]}
        sortField="ticker"
        sortDir="asc"
        onToggleSort={vi.fn()}
      />,
    );
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('shows empty state when no positions passed', () => {
    render(
      <PositionsTable
        sortedPositions={[]}
        sortField="ticker"
        sortDir="asc"
        onToggleSort={vi.fn()}
      />,
    );
    expect(screen.getByText('No open positions')).toBeInTheDocument();
  });
});
