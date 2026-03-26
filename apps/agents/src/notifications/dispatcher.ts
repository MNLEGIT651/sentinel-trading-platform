import { type NotificationPayload } from '@sentinel/shared';
import { EmailSender } from './email.js';
import { logger } from '../logger.js';

/**
 * Central notification router. Dispatches to configured channels.
 * Falls back gracefully when channels are unconfigured.
 */
export class NotificationDispatcher {
  private emailSender: EmailSender;

  constructor() {
    this.emailSender = new EmailSender();
  }

  async dispatch(payload: NotificationPayload): Promise<void> {
    const results = await Promise.allSettled([this.emailSender.send(payload)]);

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.warn('Notification channel failed', { error: String(result.reason) });
      }
    }
  }
}
