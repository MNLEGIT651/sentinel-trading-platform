import { type NotificationPayload } from '@sentinel/shared';
import { logger } from '../logger.js';

/**
 * Email notification sender using Resend API.
 * No-op when RESEND_API_KEY is not configured.
 */
export class EmailSender {
  private apiKey: string | undefined;
  private fromAddress = 'Sentinel Trading <notifications@sentinel.trading>';

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!this.isConfigured) return;

    const severityColor =
      {
        info: '#3b82f6',
        warning: '#f59e0b',
        critical: '#ef4444',
      }[payload.severity] ?? '#6b7280';

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: process.env.NOTIFICATION_EMAIL ?? '',
          subject: `[Sentinel] ${payload.title}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="border-left: 4px solid ${severityColor}; padding: 12px 16px; background: #f9fafb; margin-bottom: 16px;">
                <h2 style="margin: 0 0 8px 0; font-size: 18px;">${payload.title}</h2>
                <p style="margin: 0; color: #4b5563;">${payload.body}</p>
              </div>
              ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display: inline-block; padding: 8px 16px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 6px;">View in Dashboard</a>` : ''}
              <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">Sentinel Trading Platform</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        logger.warn('Email send failed', { status: response.status });
      }
    } catch (error) {
      logger.warn('Email send error', { error: String(error) });
    }
  }
}
