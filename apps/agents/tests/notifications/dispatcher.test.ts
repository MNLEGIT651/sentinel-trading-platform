import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationDispatcher } from '../../src/notifications/dispatcher.js';
import { EmailSender } from '../../src/notifications/email.js';
import type { NotificationPayload } from '@sentinel/shared';

const infoPayload: NotificationPayload = {
  title: 'Market Alert',
  body: 'SPY breached 200-day MA',
  severity: 'info',
};

const criticalPayload: NotificationPayload = {
  title: 'Circuit Breaker Triggered',
  body: 'Portfolio drawdown exceeded 15%',
  severity: 'critical',
  actionUrl: 'https://app.example.com/portfolio',
};

describe('NotificationDispatcher', () => {
  let dispatcher: NotificationDispatcher;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatcher = new NotificationDispatcher();
    sendSpy = vi.spyOn(EmailSender.prototype, 'send').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches info payload to email channel', async () => {
    await dispatcher.dispatch(infoPayload);
    expect(sendSpy).toHaveBeenCalledWith(infoPayload);
  });

  it('dispatches critical payload to email channel', async () => {
    await dispatcher.dispatch(criticalPayload);
    expect(sendSpy).toHaveBeenCalledWith(criticalPayload);
  });

  it('does not throw when email channel fails', async () => {
    sendSpy.mockRejectedValue(new Error('SMTP connection refused'));

    // Should resolve without throwing — failures are swallowed via allSettled
    await expect(dispatcher.dispatch(infoPayload)).resolves.toBeUndefined();
  });

  it('calls email send exactly once per dispatch', async () => {
    await dispatcher.dispatch(infoPayload);
    await dispatcher.dispatch(infoPayload);
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });
});
