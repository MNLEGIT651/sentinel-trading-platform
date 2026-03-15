import { describe, it, expect, vi, afterEach } from 'vitest';
import { isMarketOpen } from '../src/scheduler.js';

describe('isMarketOpen', () => {
  afterEach(() => vi.useRealTimers());

  // All tests use a known winter date (2025-01-06 Monday, UTC-5 = EST)
  // UTC ms = desired_ET_hour * 3600000 + 5 * 3600000 (UTC-5 offset)
  function setETTime(weekday: string, hour: number, minute: number) {
    const days: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const etOffsetMs = 5 * 60 * 60 * 1000; // UTC-5 in winter
    const baseMonday = new Date('2025-01-06T00:00:00Z').getTime();
    const dayOffset = (days[weekday] ?? 0) * 24 * 60 * 60 * 1000;
    const timeMs = (hour * 60 + minute) * 60 * 1000 + etOffsetMs;
    vi.useFakeTimers();
    vi.setSystemTime(baseMonday + dayOffset + timeMs);
  }

  it('returns true Mon 9:30 ET', () => {
    setETTime('Mon', 9, 30);
    expect(isMarketOpen()).toBe(true);
  });

  it('returns true Fri 15:59 ET', () => {
    setETTime('Fri', 15, 59);
    expect(isMarketOpen()).toBe(true);
  });

  it('returns false Mon 9:29 ET (pre-market)', () => {
    setETTime('Mon', 9, 29);
    expect(isMarketOpen()).toBe(false);
  });

  it('returns false Mon 16:00 ET (closed)', () => {
    setETTime('Mon', 16, 0);
    expect(isMarketOpen()).toBe(false);
  });

  it('returns false Saturday', () => {
    setETTime('Sat', 11, 0);
    expect(isMarketOpen()).toBe(false);
  });

  it('returns false Sunday', () => {
    setETTime('Sun', 14, 0);
    expect(isMarketOpen()).toBe(false);
  });
});
