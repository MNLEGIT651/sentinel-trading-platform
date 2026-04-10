import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DataProvenance } from '@/components/ui/data-provenance';

describe('DataProvenance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Flush the deferred setTimeout(0) that computes ageMs */
  function flushAgeComputation() {
    act(() => {
      vi.advanceTimersByTime(0);
    });
  }

  // --- Mode rendering ---

  it('renders live mode with green styling', () => {
    render(<DataProvenance mode="live" />);
    flushAgeComputation();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Live'),
    );
  });

  it('renders cached mode with yellow styling', () => {
    render(<DataProvenance mode="cached" lastUpdated={new Date('2026-01-15T11:58:00Z')} />);
    flushAgeComputation();
    expect(screen.getByText('Cached')).toBeInTheDocument();
    expect(screen.getByText(/2m ago/)).toBeInTheDocument();
  });

  it('renders paper mode with amber styling', () => {
    render(<DataProvenance mode="paper" />);
    flushAgeComputation();
    expect(screen.getByText('Paper')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Paper'),
    );
  });

  it('renders offline mode with red styling', () => {
    render(<DataProvenance mode="offline" />);
    flushAgeComputation();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  // --- Stale threshold ---

  it('auto-downgrades live to stale when lastUpdated exceeds threshold', () => {
    const twoMinutesAgo = new Date('2026-01-15T11:58:00Z');
    render(<DataProvenance mode="live" lastUpdated={twoMinutesAgo} staleThresholdMs={60_000} />);
    flushAgeComputation();
    expect(screen.getByText(/stale/i)).toBeInTheDocument();
    expect(screen.getByText(/2m ago/)).toBeInTheDocument();
  });

  it('does not show stale when within threshold', () => {
    const thirtySecondsAgo = new Date('2026-01-15T11:59:30Z');
    render(<DataProvenance mode="live" lastUpdated={thirtySecondsAgo} staleThresholdMs={60_000} />);
    flushAgeComputation();
    expect(screen.queryByText(/stale/i)).not.toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('respects custom staleThresholdMs', () => {
    const tenSecondsAgo = new Date('2026-01-15T11:59:50Z');
    render(<DataProvenance mode="live" lastUpdated={tenSecondsAgo} staleThresholdMs={5_000} />);
    flushAgeComputation();
    expect(screen.getByText(/stale/i)).toBeInTheDocument();
  });

  // --- Missing lastUpdated ---

  it('renders live mode without detail when lastUpdated is null', () => {
    render(<DataProvenance mode="live" lastUpdated={null} />);
    flushAgeComputation();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });

  it('renders live mode without detail when lastUpdated is undefined', () => {
    render(<DataProvenance mode="live" />);
    flushAgeComputation();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
  });

  // --- String lastUpdated ---

  it('accepts lastUpdated as an ISO string', () => {
    render(<DataProvenance mode="cached" lastUpdated="2026-01-15T11:55:00Z" />);
    flushAgeComputation();
    expect(screen.getByText(/5m ago/)).toBeInTheDocument();
  });

  // --- className passthrough ---

  it('merges custom className', () => {
    render(<DataProvenance mode="live" className="my-custom-class" />);
    flushAgeComputation();
    expect(screen.getByRole('status')).toHaveClass('my-custom-class');
  });

  // --- ARIA ---

  it('includes accessible aria-label with mode info', () => {
    render(<DataProvenance mode="offline" />);
    flushAgeComputation();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Offline'),
    );
  });
});
