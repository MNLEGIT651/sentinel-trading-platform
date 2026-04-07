import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/api/internal/cron/health/route';

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
});

describe('/api/internal/cron/health', () => {
  it('returns 401 when cron secret is missing', async () => {
    delete process.env.CRON_SECRET;
    const request = new Request('https://example.com/api/internal/cron/health');

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 401 when authorization header does not match', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    const request = new Request('https://example.com/api/internal/cron/health', {
      headers: { authorization: 'Bearer wrong-secret' },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns health payload when authorization header matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'engine-key';
    process.env.AGENTS_URL = 'https://agents.example';

    const fetchMock = async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as typeof fetch;

    try {
      const request = new Request('https://example.com/api/internal/cron/health', {
        headers: { authorization: 'Bearer expected-secret' },
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty('status');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
