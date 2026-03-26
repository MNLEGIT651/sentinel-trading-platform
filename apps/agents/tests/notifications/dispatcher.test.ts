/**
 * Unit tests for NotificationDispatcher.
 *
 * Tests central notification routing and error resilience.
 * Dispatcher must continue working even if individual channels fail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationDispatcher } from '../../src/notifications/dispatcher.js';
import type { NotificationPayload } from '@sentinel/shared';

// Mock the EmailSender module
vi.mock('../../src/notifications/email.js', () => ({
  EmailSender: vi.fn().mockImplementation(function () {
    return {
      send: vi.fn().mockResolvedValue(undefined),
      isConfigured: true,
    };
  }),
}));

// Mock logger to suppress console output during tests
vi.mock('../../src/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NotificationDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches to email sender', async () => {
    const dispatcher = new NotificationDispatcher();
    const payload: NotificationPayload = {
      severity: 'info',
      title: 'Test Alert',
      body: 'This is a test notification',
    };

    await dispatcher.dispatch(payload);

    // EmailSender.send should have been called
    // Access the mock through the module
    const { EmailSender } = await import('../../src/notifications/email.js');
    const mockEmailSender = vi.mocked(EmailSender).mock.results[0]?.value;
    expect(mockEmailSender.send).toHaveBeenCalledOnce();
    expect(mockEmailSender.send).toHaveBeenCalledWith(payload);
  });

  it('handles email sender failure gracefully', async () => {
    // Mock EmailSender to throw error
    const { EmailSender } = await import('../../src/notifications/email.js');
    vi.mocked(EmailSender).mockImplementationOnce(function () {
      return {
        send: vi.fn().mockRejectedValue(new Error('Email service unavailable')),
        isConfigured: true,
      } as never;
    });

    const dispatcher = new NotificationDispatcher();
    const payload: NotificationPayload = {
      severity: 'warning',
      title: 'Trade Alert',
      body: 'High volatility detected',
    };

    // Should not throw
    await expect(dispatcher.dispatch(payload)).resolves.toBeUndefined();

    // Logger should have been called with warning
    const { logger } = await import('../../src/logger.js');
    expect(logger.warn).toHaveBeenCalledWith(
      'Notification channel failed',
      expect.objectContaining({
        error: expect.stringContaining('Email service unavailable'),
      }),
    );
  });

  it('dispatches to all configured channels', async () => {
    const dispatcher = new NotificationDispatcher();
    const payload: NotificationPayload = {
      severity: 'critical',
      title: 'System Alert',
      body: 'Trading halted due to circuit breaker',
    };

    await dispatcher.dispatch(payload);

    // In the future, when more channels are added (push, SMS), they should all be called
    // For now, just verify email was called
    const { EmailSender } = await import('../../src/notifications/email.js');
    const mockEmailSender = vi.mocked(EmailSender).mock.results[0]?.value;
    expect(mockEmailSender.send).toHaveBeenCalledOnce();
  });

  it('continues dispatching even if one channel fails', async () => {
    // This test prepares for future multi-channel support
    // Currently only email exists, but dispatcher should be resilient
    const { EmailSender } = await import('../../src/notifications/email.js');
    vi.mocked(EmailSender).mockImplementationOnce(function () {
      return {
        send: vi.fn().mockRejectedValue(new Error('Email failed')),
        isConfigured: true,
      } as never;
    });

    const dispatcher = new NotificationDispatcher();
    const payload: NotificationPayload = {
      severity: 'info',
      title: 'Test',
      body: 'Test body',
    };

    // Should not throw despite email failure
    await expect(dispatcher.dispatch(payload)).resolves.toBeUndefined();
  });

  it('dispatches all severity levels correctly', async () => {
    const dispatcher = new NotificationDispatcher();
    const severities: Array<'info' | 'warning' | 'critical'> = ['info', 'warning', 'critical'];

    for (const severity of severities) {
      const payload: NotificationPayload = {
        severity,
        title: `${severity} alert`,
        body: `This is a ${severity} level notification`,
      };

      await dispatcher.dispatch(payload);
    }

    const { EmailSender } = await import('../../src/notifications/email.js');
    const mockEmailSender = vi.mocked(EmailSender).mock.results[0]?.value;
    expect(mockEmailSender.send).toHaveBeenCalledTimes(3);
  });

  it('handles payloads with optional actionUrl', async () => {
    const dispatcher = new NotificationDispatcher();
    const payload: NotificationPayload = {
      severity: 'warning',
      title: 'Trade Recommendation',
      body: 'New buy signal for AAPL',
      actionUrl: 'https://sentinel.example/recommendations/123',
    };

    await dispatcher.dispatch(payload);

    const { EmailSender } = await import('../../src/notifications/email.js');
    const mockEmailSender = vi.mocked(EmailSender).mock.results[0]?.value;
    expect(mockEmailSender.send).toHaveBeenCalledWith(payload);
  });

  it('handles payloads without actionUrl', async () => {
    const dispatcher = new NotificationDispatcher();
    const payload: NotificationPayload = {
      severity: 'info',
      title: 'Agent Cycle Complete',
      body: 'All agents finished successfully',
    };

    await dispatcher.dispatch(payload);

    const { EmailSender } = await import('../../src/notifications/email.js');
    const mockEmailSender = vi.mocked(EmailSender).mock.results[0]?.value;
    expect(mockEmailSender.send).toHaveBeenCalledWith(payload);
  });

  it('does not throw when logger fails', async () => {
    const { logger } = await import('../../src/logger.js');
    vi.mocked(logger.warn).mockImplementationOnce(() => {
      throw new Error('Logger broke');
    });

    const { EmailSender } = await import('../../src/notifications/email.js');
    vi.mocked(EmailSender).mockImplementationOnce(function () {
      return {
        send: vi.fn().mockRejectedValue(new Error('Email failed')),
        isConfigured: true,
      } as never;
    });

    const dispatcher = new NotificationDispatcher();
    const payload: NotificationPayload = {
      severity: 'info',
      title: 'Test',
      body: 'Test body',
    };

    // Should not throw even if logger throws
    await expect(dispatcher.dispatch(payload)).resolves.toBeUndefined();
  });
});
