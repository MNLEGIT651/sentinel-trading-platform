import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SnapshotMetrics } from '@/components/portfolio/snapshot-metrics';

describe('SnapshotMetrics', () => {
  it('renders at least one numeric value (portfolio total or P&L)', () => {
    render(
      <SnapshotMetrics
        portfolioTotal={105000}
        totalPnl={5000}
        totalPnlPct={5.0}
        totalCost={100000}
        cashBalance={50000}
        positionCount={3}
        totalValue={55000}
      />,
    );
    // Portfolio Value label should be present
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    // The formatted total should appear
    expect(screen.getByText('$105,000.00')).toBeInTheDocument();
  });
});
