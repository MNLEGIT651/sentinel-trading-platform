import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalCard } from '@/components/signals/signal-card';
import type { SignalRow } from '@/components/signals/signal-card';

const mockSignal: SignalRow = {
  id: 'sig-1',
  ticker: 'NVDA',
  direction: 'long',
  strength: 0.85,
  strategy_name: 'SMA Crossover',
  reason: 'Strong upward momentum detected.',
  metadata: {},
};

describe('SignalCard', () => {
  it('renders ticker', () => {
    render(
      <table>
        <tbody>
          <SignalCard signal={mockSignal} />
        </tbody>
      </table>,
    );
    expect(screen.getByText('NVDA')).toBeInTheDocument();
  });
});
