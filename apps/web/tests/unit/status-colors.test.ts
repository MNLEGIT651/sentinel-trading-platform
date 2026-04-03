import { describe, it, expect } from 'vitest';
import {
  statusColorMap,
  getStatusColors,
  orderStatusColors,
  DEFAULT_ORDER_STYLE,
  pipelineStatusColors,
  getPipelineStatusColor,
  getSignalStrengthColor,
  sideColors,
  type StatusKey,
} from '@/lib/status-colors';

describe('statusColorMap', () => {
  const expectedKeys: StatusKey[] = ['success', 'error', 'warning', 'info', 'neutral'];

  it.each(expectedKeys)('status "%s" has bg, text, and border properties', (key) => {
    const colors = statusColorMap[key];
    expect(colors).toBeDefined();
    expect(colors.bg).toEqual(expect.any(String));
    expect(colors.text).toEqual(expect.any(String));
    expect(colors.border).toEqual(expect.any(String));
  });

  it('bg values contain "bg-"', () => {
    for (const entry of Object.values(statusColorMap)) {
      expect(entry.bg).toMatch(/^bg-/);
    }
  });

  it('text values contain "text-"', () => {
    for (const entry of Object.values(statusColorMap)) {
      expect(entry.text).toMatch(/^text-/);
    }
  });

  it('border values contain "border-"', () => {
    for (const entry of Object.values(statusColorMap)) {
      expect(entry.border).toMatch(/^border-/);
    }
  });
});

describe('getStatusColors', () => {
  it('returns correct classes for success', () => {
    const colors = getStatusColors('success');
    expect(colors.bg).toBe('bg-profit/10');
    expect(colors.text).toBe('text-profit');
    expect(colors.border).toBe('border-profit/20');
  });

  it('returns correct classes for error', () => {
    const colors = getStatusColors('error');
    expect(colors.bg).toBe('bg-loss/10');
    expect(colors.text).toBe('text-loss');
    expect(colors.border).toBe('border-loss/20');
  });

  it('returns correct classes for warning', () => {
    const colors = getStatusColors('warning');
    expect(colors.bg).toBe('bg-amber-500/10');
    expect(colors.text).toBe('text-amber-400');
    expect(colors.border).toBe('border-amber-500/20');
  });

  it('returns correct classes for info', () => {
    const colors = getStatusColors('info');
    expect(colors.bg).toBe('bg-primary/10');
    expect(colors.text).toBe('text-primary');
    expect(colors.border).toBe('border-primary/20');
  });

  it('returns correct classes for neutral', () => {
    const colors = getStatusColors('neutral');
    expect(colors.bg).toBe('bg-muted');
    expect(colors.text).toBe('text-muted-foreground');
    expect(colors.border).toBe('border-border');
  });
});

describe('orderStatusColors', () => {
  const expectedStatuses = ['pending', 'submitted', 'partial', 'filled', 'cancelled', 'rejected'];

  it.each(expectedStatuses)('order status "%s" has bg and text properties', (status) => {
    const style = orderStatusColors[status];
    expect(style).toBeDefined();
    expect(style.bg).toEqual(expect.any(String));
    expect(style.text).toEqual(expect.any(String));
  });

  it('DEFAULT_ORDER_STYLE has bg and text', () => {
    expect(DEFAULT_ORDER_STYLE.bg).toEqual(expect.any(String));
    expect(DEFAULT_ORDER_STYLE.text).toEqual(expect.any(String));
  });
});

describe('pipelineStatusColors', () => {
  const expectedStatuses = [
    'created',
    'pending',
    'pending_approval',
    'new',
    'approved',
    'filled',
    'rejected',
    'risk_blocked',
    'failed',
    'cancelled',
    'submitted',
    'partially_filled',
    'risk_checked',
    'reviewed',
  ];

  it.each(expectedStatuses)('pipeline status "%s" is defined', (status) => {
    expect(pipelineStatusColors[status]).toBeDefined();
    expect(pipelineStatusColors[status]).toEqual(expect.any(String));
  });

  it('getPipelineStatusColor returns correct color for known status', () => {
    expect(getPipelineStatusColor('approved')).toBe('bg-emerald-500/10 text-emerald-400');
  });

  it('getPipelineStatusColor falls back for unknown status', () => {
    expect(getPipelineStatusColor('unknown_status')).toBe('bg-zinc-500/10 text-zinc-400');
  });
});

describe('getSignalStrengthColor', () => {
  it('returns emerald for high strength (> 0.7)', () => {
    expect(getSignalStrengthColor(0.85)).toContain('text-emerald-400');
  });

  it('returns amber for medium strength (>= 0.5)', () => {
    expect(getSignalStrengthColor(0.6)).toContain('text-amber-400');
  });

  it('returns red for low strength (< 0.5)', () => {
    expect(getSignalStrengthColor(0.3)).toContain('text-red-400');
  });
});

describe('sideColors', () => {
  it('has buy and sell entries', () => {
    expect(sideColors.buy).toBeDefined();
    expect(sideColors.sell).toBeDefined();
  });
});
