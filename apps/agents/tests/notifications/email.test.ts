import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailSender } from '../../src/notifications/email.js';
import type { NotificationPayload } from '@sentinel/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    title: 'Test Alert',
    body: 'This is a test notification.',
    severity: 'info',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailSender.isConfigured', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when RESEND_API_KEY is missing', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('NOTIFICATION_EMAIL', 'admin@example.com');
    const sender = new EmailSender();
    expect(sender.isConfigured).toBe(false);
  });

  it('returns false when NOTIFICATION_EMAIL is missing', () => {
    vi.stubEnv('RESEND_API_KEY', 'resend-key-123');
    vi.stubEnv('NOTIFICATION_EMAIL', '');
    const sender = new EmailSender();
    expect(sender.isConfigured).toBe(false);
  });

  it('returns true when both env vars are set', () => {
    vi.stubEnv('RESEND_API_KEY', 'resend-key-123');
    vi.stubEnv('NOTIFICATION_EMAIL', 'admin@example.com');
    const sender = new EmailSender();
    expect(sender.isConfigured).toBe(true);
  });
});

describe('EmailSender.send — unconfigured', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('NOTIFICATION_EMAIL', '');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns immediately without calling fetch', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload());
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('EmailSender.send — configured', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    vi.stubEnv('NOTIFICATION_EMAIL', 'alerts@example.com');

    mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('POSTs to Resend API with correct auth header', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload());

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-resend-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('includes subject line prefixed with [Sentinel]', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload({ title: 'Price Alert' }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.subject).toBe('[Sentinel] Price Alert');
  });

  it('sends to configured recipient', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.to).toBe('alerts@example.com');
  });

  it('includes escaped title in HTML body', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload({ title: '<script>alert("xss")</script>' }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).toContain('&lt;script&gt;');
    expect(body.html).not.toContain('<script>');
  });

  it('includes escaped body text in HTML', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload({ body: '<b>Bold</b> & "quoted"' }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).toContain('&lt;b&gt;');
    expect(body.html).toContain('&amp;');
    expect(body.html).toContain('&quot;');
  });

  it('includes action link when actionUrl is a valid https URL', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload({ actionUrl: 'https://app.example.com/portfolio' }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).toContain('href="https://app.example.com/portfolio"');
    expect(body.html).toContain('View in Dashboard');
  });

  it('omits action link when actionUrl is not a valid URL', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload({ actionUrl: 'javascript:alert(1)' }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).not.toContain('View in Dashboard');
  });

  it('omits action link when actionUrl is absent', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).not.toContain('View in Dashboard');
  });

  it('does not throw when Resend returns non-ok status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422 });
    const sender = new EmailSender();
    await expect(sender.send(makePayload())).resolves.toBeUndefined();
  });

  it('does not throw when fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const sender = new EmailSender();
    await expect(sender.send(makePayload())).resolves.toBeUndefined();
  });

  it('uses info severity colour for info notifications', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload({ severity: 'info' }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).toContain('#3b82f6');
  });

  it('uses warning severity colour for warning notifications', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload({ severity: 'warning' }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).toContain('#f59e0b');
  });

  it('uses critical severity colour for critical notifications', async () => {
    const sender = new EmailSender();
    await sender.send(makePayload({ severity: 'critical' }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.html).toContain('#ef4444');
  });
});
