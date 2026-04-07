import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/internal/cron/health/route';

const originalEnv = {
  CRON_SECRET: process.env.CRON_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  ENGINE_URL: process.env.ENGINE_URL,
  ENGINE_API_KEY: process.env.ENGINE_API_KEY,
  AGENTS_URL: process.env.AGENTS_URL,
};

function restoreEnv() {
  process.env.CRON_SECRET = originalEnv.CRON_SECRET;
  (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv.NODE_ENV;
  process.env.ENGINE_URL = originalEnv.ENGINE_URL;
  process.env.ENGINE_API_KEY = originalEnv.ENGINE_API_KEY;
  process.env.AGENTS_URL = originalEnv.AGENTS_URL;
}

describe('/api/internal/cron/health', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns 401 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;

    const request = new Request('http://localhost/api/internal/cron/health');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 when authorization header is missing', async () => {
    process.env.CRON_SECRET = 'test-secret';

    const request = new Request('http://localhost/api/internal/cron/health');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 401 when authorization header has wrong secret', async () => {
    process.env.CRON_SECRET = 'test-secret';

    const request = new Request('http://localhost/api/internal/cron/health', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('delegates to health route when CRON_SECRET matches', async () => {
    process.env.CRON_SECRET = 'test-secret';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.ENGINE_URL;
    delete process.env.ENGINE_API_KEY;
    delete process.env.AGENTS_URL;

    vi.stubGlobal('fetch', vi.fn());

    const request = new Request('http://localhost/api/internal/cron/health', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('service', 'sentinel-web');
    expect(body).toHaveProperty('dependencies');
  });
});
