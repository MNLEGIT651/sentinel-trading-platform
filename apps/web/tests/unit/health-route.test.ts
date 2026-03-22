import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/health/route';

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  ENGINE_URL: process.env.ENGINE_URL,
  ENGINE_API_KEY: process.env.ENGINE_API_KEY,
  AGENTS_URL: process.env.AGENTS_URL,
};

function restoreEnv() {
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  process.env.ENGINE_URL = originalEnv.ENGINE_URL;
  process.env.ENGINE_API_KEY = originalEnv.ENGINE_API_KEY;
  process.env.AGENTS_URL = originalEnv.AGENTS_URL;
}

describe('/api/health', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns not_configured dependencies without probing missing services in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENGINE_URL;
    delete process.env.ENGINE_API_KEY;
    delete process.env.AGENTS_URL;

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      status: 'ok',
      dependencies: {
        engine: 'not_configured',
        agents: 'not_configured',
      },
    });
  });

  it('reports disconnected dependencies without returning a failing route status', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'secret-key';
    process.env.AGENTS_URL = 'https://agents.example';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === 'https://engine.example/health') {
          throw new Error('engine offline');
        }

        if (url === 'https://agents.example/health') {
          return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      dependencies: {
        engine: 'disconnected',
        agents: 'connected',
      },
    });
  });
});
