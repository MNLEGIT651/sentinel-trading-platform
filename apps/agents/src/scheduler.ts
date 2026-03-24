/**
 * Market-hours scheduler — fires the agent cycle every 15 minutes
 * when the NYSE is open (09:30–15:59 ET, Mon–Fri).
 *
 * Uses the Intl.DateTimeFormat API for correct DST handling.
 */

import cron, { type ScheduledTask } from 'node-cron';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CycleRunner = () => Promise<any>;

/**
 * Returns true if the current time falls within NYSE market hours:
 * 09:30–15:59 ET, Monday–Friday. DST-correct via Intl API.
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  const timeMinutes = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 09:30 ET
  const marketClose = 16 * 60; // 16:00 ET (exclusive)

  return isWeekday && timeMinutes >= marketOpen && timeMinutes < marketClose;
}

/**
 * Returns the ISO timestamp of the next scheduled 15-minute slot,
 * or null when the market is closed (weekend / after-hours).
 */
export function getNextCycleAt(): string | null {
  if (!isMarketOpen()) return null;
  const now = new Date();
  const slotMs = 15 * 60 * 1000;
  const nextMs = Math.ceil(now.getTime() / slotMs) * slotMs;
  return new Date(nextMs).toISOString();
}

/**
 * Starts the cron-based market-hours scheduler.
 * Fires `runner` every 15 minutes when the market is open,
 * skipping if a cycle is already in progress or trading is halted.
 *
 * @returns The scheduled task (call .stop() to cancel).
 */
export function startScheduler(
  runner: CycleRunner,
  options?: {
    isRunning?: () => boolean;
    isHalted?: () => boolean;
  },
): ScheduledTask {
  // Tick every 15 minutes, all hours — we gate on isMarketOpen() internally
  const task = cron.schedule('*/15 * * * *', async () => {
    if (!isMarketOpen()) return;

    if (options?.isHalted?.()) {
      console.log('[Scheduler] Skipping cycle — trading halted');
      return;
    }

    if (options?.isRunning?.()) {
      console.log('[Scheduler] Skipping cycle — previous cycle still running');
      return;
    }

    console.log('[Scheduler] Market open — triggering agent cycle');
    try {
      await runner();
    } catch (err) {
      console.error('[Scheduler] Cycle error:', err);
    }
  });

  console.log('[Scheduler] Started — fires every 15 min during market hours (09:30–16:00 ET)');
  return task;
}
